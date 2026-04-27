/**
 * Orchestrates analytics state machine, encoder, batch queue, and player adapter.
 * Receives signals from the adapter, drives the state machine, and flushes events to ingest.
 */
import type Player from 'video.js/dist/types/player';
import type { CleanupRegistry } from '../../utils';
import type { SourceOptions } from '../../interfaces';
import type { IKAnalyticsClientContext, AnalyticsConfig, InternalAnalyticsEvent } from './types';
import {
  ANALYTICS_FLUSH_INTERVAL_MS,
  ANALYTICS_INGEST_URL,
  ANALYTICS_MAX_BATCH_SIZE,
  ANALYTICS_MAX_PLAYBACK_SPEED_FACTOR,
  ANALYTICS_TIMEUPDATE_THROTTLE_MS,
} from './constants';
import { getOrCreateSession, createPlayerInstanceId, createPlaybackId, createEventId } from './id-factory';
import { AnalyticsStateMachine } from './analytics-state-machine';
import { encodeEvent } from './event-row-encoder';
import { createBatchQueue } from './batch-queue';
import { createPlayerAdapter } from './player-adapter';
import { computeVideoUpDownScalePercentages } from './video-scale-percentage';

const PLUGIN_NAME = 'imagekit-video-player';
const PLUGIN_VERSION = '1.0.0-beta.1';
const PLAYER_SOFTWARE = 'video.js';
const PLAYER_SOFTWARE_VERSION = '8.20.0';

/** User-facing options only; ingest URL and batch defaults come from `./constants`. */
export interface AnalyticsTrackerUserConfig {
  user_id?: string;
  customDimensions?: Record<string, string>;
  debug?: boolean;
}

export interface AnalyticsTrackerOptions {
  config: AnalyticsTrackerUserConfig;
  imagekitId: string;
  player: Player;
  getCurrentSource: () => SourceOptions | null;
  cleanup: CleanupRegistry;
  pageLoadStartMonotonic?: number;
}

export function createAnalyticsTracker(options: AnalyticsTrackerOptions): void {
  const {
    config: userConfig,
    imagekitId,
    player,
    getCurrentSource,
    cleanup,
    pageLoadStartMonotonic = typeof performance !== 'undefined' ? performance.now() : 0,
  } = options;

  const config: AnalyticsConfig = {
    ingestUrl: ANALYTICS_INGEST_URL,
    flushIntervalMs: ANALYTICS_FLUSH_INTERVAL_MS,
    maxBatchSize: ANALYTICS_MAX_BATCH_SIZE,
    timeupdateThrottleMs: ANALYTICS_TIMEUPDATE_THROTTLE_MS,
    debug: userConfig.debug,
    user_id: userConfig.user_id,
    customDimensions: userConfig.customDimensions,
  };

  const session = getOrCreateSession();
  const playerInstanceId = createPlayerInstanceId();
  let currentPlaybackId: string | null = createPlaybackId();
  let hasLoadedFirstView = false;
  let previousVideoSourceUrl: string | null = null;
  let playerReadyMonotonic = 0;
  let playingTimeAccumulatedMs = 0;
  let lastTimeupdateEmitMonotonic = 0;
  let lastEmittedPlaybackTimeMs = 0;
  let progressiveBitrateBps: number | undefined;

  const context: IKAnalyticsClientContext = {
    imagekit_id: imagekitId,
    session_id: session.session_id,
    player_instance_id: playerInstanceId,
    user_id: config.user_id,
    page_url: typeof window !== 'undefined' ? window.location.href : '',
    device_display_width: typeof screen !== 'undefined' ? screen.width : 0,
    device_display_height: typeof screen !== 'undefined' ? screen.height : 0,
    device_display_dpr: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    user_agent_data:
      typeof navigator !== 'undefined'
        ? (navigator as Navigator & { userAgentData?: unknown }).userAgentData
        : undefined,
    language: typeof navigator !== 'undefined' ? navigator.language : undefined,
    time_zone: typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined,
    session_start_date: session.session_start_date,
    session_start_time_iso: new Date(session.session_start_time_ms).toISOString(),
    player_software: PLAYER_SOFTWARE,
    player_software_version: PLAYER_SOFTWARE_VERSION,
    imagekit_plugin: PLUGIN_NAME,
    imagekit_plugin_version: PLUGIN_VERSION,
  };

  const capturePlayerUiContext = (): void => {
    try {
      const root = player.el?.();
      const rect = root?.getBoundingClientRect?.();
      const w = rect?.width ?? 0;
      const h = rect?.height ?? 0;
      // Rendered player size in CSS pixels (not the video source resolution).
      if (w > 0) context.player_width_pixels = Math.round(w);
      if (h > 0) context.player_height_pixels = Math.round(h);

      // Best-effort autoplay / preload extraction from Video.js API.
      const pAny = player as any;
      const autoplayVal = typeof pAny.autoplay === 'function' ? pAny.autoplay() : undefined;
      if (typeof autoplayVal === 'boolean') context.player_autoplay = autoplayVal;

      const preloadVal = typeof pAny.preload === 'function' ? pAny.preload() : undefined;
      if (typeof preloadVal === 'string') {
        // video.js preload: 'auto' | 'metadata' | 'none'
        context.player_preload = preloadVal;
      }
    } catch {
      // ignore
    }
  };

  const batchQueue = createBatchQueue({
    ingestUrl: config.ingestUrl,
    flushIntervalMs: config.flushIntervalMs,
    maxBatchSize: config.maxBatchSize,
    debug: config.debug,
  });

  const pushEvent = (internal: InternalAnalyticsEvent): void => {
    const eventOrder = stateMachine.getEventOrder();
    const previousEvent = stateMachine.getLastEventName();
    const msFromPrev = internal.ms_from_previous_event ?? 0;
    const encoded = encodeEvent(internal, context, currentPlaybackId, eventOrder, previousEvent, msFromPrev);
    batchQueue.push(encoded, context);
  };

  const stateMachine = new AnalyticsStateMachine(
    {
      onSessionInit: () => {},
      onPlayerReady: () => {},
      onViewInit: (newId) => { currentPlaybackId = newId; },
      onViewStarted: () => {},
      onVideoChange: (newId) => { currentPlaybackId = newId; },
      onViewEnd: () => {},
      onEvent: pushEvent,
    },
    createEventId
  );

  const captureContext = (): Partial<InternalAnalyticsEvent> => {
    const src = getCurrentSource();
    const el = player.el()?.querySelector('video') as HTMLVideoElement | null | undefined;
    const vw = el?.videoWidth ?? 0;
    const vh = el?.videoHeight ?? 0;
    const dur = player.duration();
    const ct = player.currentTime();
    const totalDurMs = typeof dur === 'number' && isFinite(dur) ? Math.round(dur * 1000) : undefined;
    const playbackTimeMs = typeof ct === 'number' && isFinite(ct) ? Math.round(ct * 1000) : undefined;
    const scale = computeVideoUpDownScalePercentages(el);

    return {
      video_source_url: src?.src,
      video_width_pixels: vw || undefined,
      video_height_pixels: vh || undefined,
      video_total_duration_ms: totalDurMs,
      playback_time_instant_ms: playbackTimeMs,
      playing_time_ms: playingTimeAccumulatedMs,
      video_upscale_percentage: scale.video_upscale_percentage,
      video_downscale_percentage: scale.video_downscale_percentage,
    };
  };

  // Session init on first use
  stateMachine.dispatch({ type: 'session_init' });

  createPlayerAdapter(player, cleanup, getCurrentSource, {
    onSignal: (sig) => {
      switch (sig.type) {
        case 'player_ready': {
          capturePlayerUiContext();
          playerReadyMonotonic = typeof performance !== 'undefined' ? performance.now() : Date.now();
          /**
           * Player startup: ImageKit plugin / player initialization start → Video.js `ready`.
           * `pageLoadStartMonotonic` is `performance.now()` at plugin ctor (see `index.ts`).
           */
          const playerStartupMs = Math.round(playerReadyMonotonic - pageLoadStartMonotonic);
          /**
           * Page load segment: navigation → player initialization start (same ctor timestamp).
           * `performance.now()` at ctor = ms since navigation time origin.
           */
          const pageLoadMs =
            typeof performance !== 'undefined'
              ? Math.round(pageLoadStartMonotonic)
              : playerStartupMs;
          stateMachine.dispatch({
            type: 'player_ready',
            playerStartupTimeMs: playerStartupMs,
            pageLoadTimeMs: pageLoadMs,
          });
          break;
        }
        case 'load_start': {
          const source = sig.source;
          const videoSourceUrl = source?.src ?? '';
          const isFirstView = !hasLoadedFirstView;
          const prevSourceUrl = previousVideoSourceUrl;
          const isVideoChange = !isFirstView && !!videoSourceUrl && !!prevSourceUrl && videoSourceUrl !== prevSourceUrl;

          previousVideoSourceUrl = videoSourceUrl;
          playingTimeAccumulatedMs = 0;
          lastEmittedPlaybackTimeMs = 0;
          lastTimeupdateEmitMonotonic = 0;
          progressiveBitrateBps = undefined;

          // For progressive sources (no ABR), estimate bitrate from Content-Length + duration.
          const isABR = !!source?.abs;
          if (!isABR && videoSourceUrl) {
            const srcUrl = videoSourceUrl;
            player.one('loadedmetadata', () => {
              const dur = player.duration();
              if (typeof dur !== 'number' || !isFinite(dur) || dur <= 0) return;
              fetch(srcUrl, { method: 'HEAD' })
                .then(res => {
                  const cl = res.headers.get('content-length');
                  if (cl) {
                    const bytes = parseInt(cl, 10);
                    if (bytes > 0) progressiveBitrateBps = Math.round((bytes * 8) / dur);
                  }
                })
                .catch(() => { /* ignore – CORS or network failure */ });
            });
          }

          const newPlaybackId = isFirstView ? currentPlaybackId! : createPlaybackId();
          hasLoadedFirstView = true;
          stateMachine.dispatch(
            {
              type: 'load_start',
              playbackId: newPlaybackId,
              videoSourceUrl,
              previousVideoSourceUrl: prevSourceUrl ?? undefined,
              isFirstView,
              isVideoChange,
            },
            captureContext
          );
          break;
        }
        case 'play':
          stateMachine.dispatch({ type: 'play' }, captureContext);
          break;
        case 'playing':
          stateMachine.dispatch({ type: 'playing' }, captureContext);
          break;
        case 'pause':
          stateMachine.dispatch({ type: 'pause' }, captureContext);
          break;
        case 'timeupdate': {
          const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
          const throttleMs = config.timeupdateThrottleMs;
          const elapsed = lastTimeupdateEmitMonotonic ? now - lastTimeupdateEmitMonotonic : throttleMs;
          if (elapsed < throttleMs) break; // throttle: only emit every N ms

          const ct = player.currentTime();
          const playbackTimeMs = typeof ct === 'number' && isFinite(ct) ? Math.round(ct * 1000) : 0;
          const rawDelta = playbackTimeMs - lastEmittedPlaybackTimeMs;
          const maxPlausibleDelta = elapsed * ANALYTICS_MAX_PLAYBACK_SPEED_FACTOR;
          const isDiscontinuity = rawDelta < 0 || rawDelta > maxPlausibleDelta;
          const playedDeltaMs = isDiscontinuity ? 0 : Math.max(0, rawDelta);
          playingTimeAccumulatedMs += playedDeltaMs;
          lastTimeupdateEmitMonotonic = now;
          lastEmittedPlaybackTimeMs = playbackTimeMs;

          let bitrate: number | undefined;
          try {
            const ql = (player as any).qualityLevels?.();
            if (ql && typeof ql.selectedIndex === 'number') {
              const selected = ql[ql.selectedIndex];
              if (selected?.height) bitrate = (selected as any).bitrate;
            }
          } catch {
            /* ignore */
          }
          // Fallback: use estimated progressive bitrate when ABR quality levels unavailable
          if (bitrate === undefined && progressiveBitrateBps !== undefined) {
            bitrate = progressiveBitrateBps;
          }
          if (config.debug) {
            console.log('[IK Analytics] timeupdate bitrate', {
              bitrate_bps: bitrate,
              bitrate_mbps_approx:
                typeof bitrate === 'number' && isFinite(bitrate) ? bitrate / 1e6 : undefined,
            });
          }

          stateMachine.dispatch(
            {
              type: 'timeupdate',
              playbackTimeMs,
              playingTimeMs: playingTimeAccumulatedMs,
              playedDeltaMs,
              bitrate,
            },
            captureContext
          );
          break;
        }
        case 'seeking': {
          const ct = player.currentTime();
          const fromMs = typeof ct === 'number' && isFinite(ct) ? ct * 1000 : 0;
          // Re-base when seeking is observed first so a racing timeupdate is less likely to use a stale baseline.
          lastEmittedPlaybackTimeMs =
            typeof ct === 'number' && isFinite(ct) ? Math.round(ct * 1000) : 0;
          stateMachine.dispatch({ type: 'seeking', fromPositionMs: fromMs }, captureContext);
          break;
        }
        case 'seeked': {
          const ct = player.currentTime();
          const toMs = typeof ct === 'number' && isFinite(ct) ? ct * 1000 : 0;
          // Re-base so the next timeupdate delta is ~0 until currentTime advances (avoids inflating
          // played_delta_ms by the seek jump vs lastEmittedPlaybackTimeMs).
          const playbackTimeMs =
            typeof ct === 'number' && isFinite(ct) ? Math.round(ct * 1000) : 0;
          lastEmittedPlaybackTimeMs = playbackTimeMs;
          const seekTimeMs = 0; // state machine computes from seeking
          stateMachine.dispatch({ type: 'seeked', toPositionMs: toMs, seekTimeMs }, captureContext);
          break;
        }
        case 'waiting':
          stateMachine.dispatch({ type: 'waiting' }, captureContext);
          break;
        case 'ended':
          stateMachine.dispatch({ type: 'ended' }, captureContext);
          break;
        case 'error': {
          const err = sig.error;
          let code = 'UNKNOWN';
          let message: string | undefined;
          let errCtx: string | undefined;
          if (err && typeof err === 'object') {
            const e = err as { code?: number; message?: string; status?: number };
            code = String(e.code ?? e.status ?? 'UNKNOWN');
            message = e.message;
            errCtx = JSON.stringify(err);
          }
          stateMachine.dispatch(
            { type: 'error', errorCode: code, errorMessage: message, errorContext: errCtx },
            captureContext
          );
          break;
        }
        case 'source_changed':
          // Handled via load_start; source_changed can be used for additional logic if needed
          break;
        case 'dispose':
          stateMachine.dispatch({ type: 'dispose' }, captureContext);
          batchQueue.flush('dispose');
          break;
      }
    },
  });

  // Visibility-based flush
  if (typeof document !== 'undefined') {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        batchQueue.flush('visibility_hidden');
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    cleanup.register(() => document.removeEventListener('visibilitychange', onVisibilityChange));
  }
}
