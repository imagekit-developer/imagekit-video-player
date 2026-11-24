/**
 * Orchestrates analytics state machine, encoder, and batch queue.
 * Receives signals from the player binding, drives the state machine, and flushes events to ingest.
 */
import type { AnalyticsEvent, IKAnalyticsClientContext } from './types';
import type { AnalyticsPlatform } from './platform';
import type { AnalyticsErrorInfo, AnalyticsPlayer, PlayerSignal } from './player';
import {
  ANALYTICS_FLUSH_INTERVAL_MS,
  ANALYTICS_INGEST_URL,
  ANALYTICS_MAX_BATCH_SIZE,
  ANALYTICS_MAX_TIMEUPDATE_GAP_MS,
  ANALYTICS_MIN_REBUFFER_MS,
  ANALYTICS_PLAYHEAD_TICK_MS,
  ANALYTICS_TIMEUPDATE_THROTTLE_MS,
} from './constants';
import { PlayedTimeCounter } from './played-time-counter';
import { scheduleRepeating } from './timers';
import { createPlayerInstanceId, createPlaybackId, createEventId, sessionStoreFor } from './id-factory';
import { AnalyticsStateMachine } from './analytics-state-machine';
import { encodeEventRowV1 } from './wire-format-v1';
import { createBatchQueue } from './batch-queue';

/** All fields optional; omitted fields keep their original value. */
export interface MappedAnalyticsError {
  code?: string;
  message?: string;
  context?: string;
}

export interface AnalyticsTrackerUserConfig {
  userId?: string;
  customDimensions?: Record<string, string>;
  mapError?: (error: AnalyticsErrorInfo) => MappedAnalyticsError | undefined | null;
  /** Logs every event and beacon. */
  debug?: boolean;
}

/** The ImageKit SDK embedding the tracker, reported as `imagekit_plugin`. */
export interface AnalyticsIntegration {
  name: string;
  version: string;
}

export interface AnalyticsTrackerOptions {
  config: AnalyticsTrackerUserConfig;
  imagekitId: string;
  player: AnalyticsPlayer;
  platform: AnalyticsPlatform;
  integration: AnalyticsIntegration;
  /** Monotonic time at which the integration started initializing; defaults to now. */
  initMonotonicMs?: number;
}

export interface AnalyticsTrackerHandle {
  /**
   * Manually report an error into the analytics pipeline without changing
   * player state. Goes through `mapError` like a native player error.
   */
  reportError(error: AnalyticsErrorInfo): void;
  /** Replaces all custom dimensions; events already recorded keep the previous values. */
  setCustomDimensions(dims: Record<string, string>): void;
  getCustomDimensions(): Record<string, string>;
  /** Flushes pending events and stops listening to the player and host. */
  dispose(): void;
}

const CUSTOM_DIMENSION_SLOT_RE = /^cd_\d+$/;

function sanitizeCustomDimensions(
  dims: Record<string, string> | undefined,
  warn: (message: string) => void
): Record<string, string> | undefined {
  if (!dims || typeof dims !== 'object') return undefined;
  const out: Record<string, string> = {};
  let count = 0;
  for (const [slot, value] of Object.entries(dims)) {
    if (!CUSTOM_DIMENSION_SLOT_RE.test(slot)) {
      warn(`custom dimension "${slot}" dropped: key must look like cd_1`);
      continue;
    }
    const s = value === null || value === undefined ? '' : String(value);
    if (!s) {
      warn(`custom dimension "${slot}" dropped: value is empty`);
      continue;
    }
    out[slot] = s;
    count++;
  }
  return count > 0 ? out : undefined;
}

function secondsToMs(seconds: number | undefined): number | undefined {
  return typeof seconds === 'number' && isFinite(seconds) ? Math.round(seconds * 1000) : undefined;
}

/** Never throws: if the tracker cannot start, analytics is disabled and the player is unaffected. */
export function createAnalyticsTracker(options: AnalyticsTrackerOptions): AnalyticsTrackerHandle {
  try {
    return createTracker(options);
  } catch (err) {
    options.platform.log('warn', 'analytics disabled: tracker failed to start', err);
    return { reportError() {}, setCustomDimensions() {}, getCustomDimensions: () => ({}), dispose() {} };
  }
}

function createTracker(options: AnalyticsTrackerOptions): AnalyticsTrackerHandle {
  const { config: userConfig, imagekitId, player, platform, integration } = options;
  const { clock } = platform;
  const initMonotonicMs = options.initMonotonicMs ?? clock.monotonicNow();
  const warn = (message: string, data?: unknown): void => platform.log('warn', message, data);
  const debug = userConfig.debug
    ? (message: string, data?: unknown): void => platform.log('debug', message, data)
    : (): void => {};
  const internalError = (err: unknown): void => warn('internal error; some analytics may be missing', err);

  // First touch on a fresh host start is never a rotation; it seeds the tracker context.
  const sessionStore = sessionStoreFor(platform.storage);
  const session = sessionStore.resolve(clock.now()).identity;
  const playerInstanceId = createPlayerInstanceId();
  // Holds the new session identity during a rotation. Applied only once the state machine has
  // emitted the OLD view's closing viewend (via the onSessionInit callback), so that viewend
  // keeps the old session_id.
  let pendingRotation: { session_id: string; session_start_date: string; session_start_time_iso: string } | null =
    null;
  // The open view's URL, from its load_start. Every row of the view carries it.
  let viewSourceUrl: string | null = null;
  let viewSourceKey: string | null = null;
  const playedTime = new PlayedTimeCounter(ANALYTICS_MAX_TIMEUPDATE_GAP_MS);
  let stopTicks: (() => void) | undefined;
  let lastReportMonotonic = clock.monotonicNow();
  let resumeCountingAfterSeek = false;

  const device = platform.getDeviceContext();
  const context: IKAnalyticsClientContext = {
    imagekit_id: imagekitId,
    session_id: session.session_id,
    player_instance_id: playerInstanceId,
    user_id: userConfig.userId,
    page_url: device.page_url,
    device_display_width: device.device_display_width,
    device_display_height: device.device_display_height,
    device_display_dpr: device.device_display_dpr,
    user_agent: device.user_agent,
    session_start_date: session.session_start_date,
    session_start_time_iso: new Date(session.session_start_time_ms).toISOString(),
    player_software: player.software,
    player_software_version: player.softwareVersion,
    imagekit_plugin: integration.name,
    imagekit_plugin_version: integration.version,
    custom_dimensions: sanitizeCustomDimensions(userConfig.customDimensions, warn),
    webdriver: device.webdriver === true ? true : undefined,
  };

  const capturePlayerUiContext = (): void => {
    try {
      const ui = player.getUiContext();
      const w = ui.width ?? 0;
      const h = ui.height ?? 0;
      if (w > 0) context.player_width_pixels = Math.round(w);
      if (h > 0) context.player_height_pixels = Math.round(h);
      if (typeof ui.autoplay === 'boolean') context.player_autoplay = ui.autoplay;
      if (typeof ui.preload === 'string') context.player_preload = ui.preload;
    } catch {
      // Optional: rows go out without the player box.
    }
  };

  const batchQueue = createBatchQueue({
    ingestUrl: ANALYTICS_INGEST_URL,
    flushIntervalMs: ANALYTICS_FLUSH_INTERVAL_MS,
    maxBatchSize: ANALYTICS_MAX_BATCH_SIZE,
    transport: platform.transport,
    debugLog: debug,
    onInternalError: internalError,
    clock,
  });

  const pushEvent = (event: AnalyticsEvent): void => {
    debug(`event ${event.event}`, event);
    batchQueue.push(encodeEventRowV1(event, clock.now()), context);
  };

  const stateMachine = new AnalyticsStateMachine(
    {
      onSessionInit: () => {
        // On a rotation, flip to the new session here — after the old view's
        // viewend(sessionrotate) has been emitted, before sessioninit.
        if (pendingRotation) {
          // Context travels per batch: ship the old view's queued viewend under the old session.
          batchQueue.flush('manual');
          context.session_id = pendingRotation.session_id;
          context.session_start_date = pendingRotation.session_start_date;
          context.session_start_time_iso = pendingRotation.session_start_time_iso;
          pendingRotation = null;
        }
      },
      onEvent: pushEvent,
    },
    { eventId: createEventId, playbackId: createPlaybackId },
    () => clock.monotonicNow()
  );

  const captureContext = (): Partial<AnalyticsEvent> => {
    const snapshot = player.getSnapshot();
    return {
      video_source_url: viewSourceUrl ?? undefined,
      video_width_pixels: snapshot.videoWidth || undefined,
      video_height_pixels: snapshot.videoHeight || undefined,
      video_total_duration_ms: secondsToMs(snapshot.duration),
      playback_time_instant_ms: secondsToMs(player.getCurrentTime()),
      playing_time_ms: playedTime.total,
      video_upscale_percentage: snapshot.upscalePercentage,
      video_downscale_percentage: snapshot.downscalePercentage,
      audio_codec: snapshot.audioCodec,
      video_codec: snapshot.videoCodec,
    };
  };

  stateMachine.dispatch({ type: 'session_init' });

  /**
   * Rotates the session when the persisted one has expired: closes the current view
   * (`viewend(sessionrotate)`) and opens a warm-resume view. Called only on user-intent
   * signals (load_start / play / seeking) so background events like `pause` or
   * `timeupdate` never rotate. Touches `last_activity` (throttled) on every call.
   */
  const checkSessionRotation = (): void => {
    const previousSessionId = context.session_id;
    const { identity, rotated } = sessionStore.resolve(clock.now());
    if (!rotated) return;
    // Defer applying the new identity until onSessionInit: mutating context here would
    // stamp the OLD view's closing viewend with the new session_id.
    pendingRotation = {
      session_id: identity.session_id,
      session_start_date: identity.session_start_date,
      session_start_time_iso: new Date(identity.session_start_time_ms).toISOString(),
    };
    stateMachine.dispatch(
      {
        type: 'session_rotated',
        previousSessionId,
        videoSourceUrl: viewSourceUrl ?? undefined,
      },
      captureContext,
    );
    playedTime.resetTotal();
  };

  /**
   * Runs the user's `mapError`, then dispatches. `native` errors end the view;
   * `report` errors (from `reportError`) leave it open.
   */
  const dispatchError = (error: AnalyticsErrorInfo, kind: 'native' | 'report') => {
    let code = error.code;
    let message = error.message;
    let errCtx = error.context;
    if (typeof userConfig.mapError === 'function') {
      try {
        const mapped = userConfig.mapError({ code, message, context: errCtx });
        if (mapped && typeof mapped === 'object') {
          if (mapped.code !== undefined) code = String(mapped.code);
          if (mapped.message !== undefined) {
            if (typeof mapped.message === 'string') message = mapped.message;
            else warn('mapError returned a non-string message; reporting the original message', mapped.message);
          }
          if (mapped.context !== undefined) {
            if (typeof mapped.context === 'string') errCtx = mapped.context;
            else warn('mapError returned a non-string context; reporting the original context', mapped.context);
          }
        } else if (mapped !== undefined && mapped !== null) {
          warn('mapError must return an object, null or undefined; reporting the unmapped error', mapped);
        }
      } catch (err) {
        warn('mapError threw; reporting the unmapped error', err);
      }
    }
    const errorCode = code || 'UNKNOWN';
    stateMachine.dispatch(
      kind === 'report'
        ? { type: 'report_error', errorCode, errorMessage: message, errorContext: errCtx }
        : { type: 'error', errorCode, errorMessage: message, errorContext: errCtx },
      captureContext,
    );
  };

  const currentTimeMsOrZero = (): number => secondsToMs(player.getCurrentTime()) ?? 0;

  // The bitrate last read; at a rendition switch it is still the old rendition's.
  let windowBitrate: number | undefined;
  const readBitrate = (): number | undefined => {
    try {
      windowBitrate = player.getBitrate();
    } catch {
      windowBitrate = undefined;
    }
    return windowBitrate;
  };

  const readRate = (): number => {
    try {
      const rate = player.getPlaybackRate();
      return typeof rate === 'number' && rate > 0 ? rate : 1;
    } catch {
      return 1;
    }
  };

  /** Sends the time counted since the last row as a `timeupdate`, weighted with `bitrate`. */
  const report = (bitrate = readBitrate()): void => {
    // The state machine drops timeupdate outside `playing`; the time stays for the next row.
    if (!stateMachine.isPlaying()) return;
    lastReportMonotonic = clock.monotonicNow();
    stateMachine.dispatch(
      {
        type: 'timeupdate',
        playbackTimeMs: playedTime.position,
        playingTimeMs: playedTime.total,
        playedDeltaMs: playedTime.takeUnreported(),
        bitrate,
      },
      captureContext
    );
  };

  const tick = (): void => playedTime.tick(currentTimeMsOrZero(), clock.monotonicNow(), readRate());

  const onTick = (): void => {
    if (!playedTime.isCounting) return;
    tick();
    const due = clock.monotonicNow() - lastReportMonotonic >= ANALYTICS_TIMEUPDATE_THROTTLE_MS;
    if (due && playedTime.hasUnreported) report();
  };

  const startCounting = (): void => {
    if (!stateMachine.isPlaying()) return;
    playedTime.start(currentTimeMsOrZero(), clock.monotonicNow(), readRate());
    stopTicks ??= scheduleRepeating(
      clock,
      () => {
        try {
          onTick();
        } catch (err) {
          internalError(err);
        }
      },
      ANALYTICS_PLAYHEAD_TICK_MS
    );
  };

  const stopTimer = (): void => {
    stopTicks?.();
    stopTicks = undefined;
  };

  /** Counts up to where playback stopped and sends it before the stop is dispatched. */
  const stopCounting = (): void => {
    stopTimer();
    playedTime.stop(currentTimeMsOrZero(), clock.monotonicNow(), readRate());
    if (playedTime.hasUnreported) report();
  };

  /**
   * Same, at a seek or source change, where the player already reports the new position.
   * Returns the position left.
   */
  const stopCountingAtJump = (): number => {
    stopTimer();
    const fromMs = playedTime.seek(clock.monotonicNow());
    if (playedTime.hasUnreported) report();
    return fromMs;
  };

  /** Sends what played up to now without stopping counting. */
  const flushCounted = (bitrate = readBitrate()): void => {
    tick();
    if (playedTime.hasUnreported) report(bitrate);
  };

  const onSignal = (sig: PlayerSignal): void => {
    switch (sig.type) {
      case 'player_ready': {
        capturePlayerUiContext();
        const playerReadyMonotonic = clock.monotonicNow();
        const playerStartupMs = Math.round(playerReadyMonotonic - initMonotonicMs);
        const pageLoadMs = platform.getPageLoadTimeMs?.(initMonotonicMs);
        stateMachine.dispatch({
          type: 'player_ready',
          playerStartupTimeMs: playerStartupMs,
          pageLoadTimeMs: pageLoadMs,
        });
        break;
      }
      case 'load_start': {
        stopCountingAtJump();
        checkSessionRotation();
        const videoSourceUrl = sig.sourceUrl;
        const prevSourceUrl = viewSourceUrl;
        const sourceKey = sig.sourceKey || videoSourceUrl;
        const isVideoChange = !!sourceKey && !!viewSourceKey && sourceKey !== viewSourceKey;

        viewSourceUrl = videoSourceUrl;
        viewSourceKey = sourceKey;
        player.resetSourceState();

        stateMachine.dispatch(
          {
            type: 'load_start',
            videoSourceUrl,
            previousVideoSourceUrl: prevSourceUrl ?? undefined,
            isVideoChange,
          },
          captureContext
        );
        // Reset only now: the old view's closing viewend above still reports its playing time.
        playedTime.resetTotal();
        playedTime.position = 0;
        resumeCountingAfterSeek = false;
        lastReportMonotonic = clock.monotonicNow();
        break;
      }
      case 'play': {
        checkSessionRotation();
        stateMachine.dispatch({ type: 'play' }, captureContext);
        break;
      }
      case 'playing':
        stateMachine.dispatch({ type: 'playing' }, captureContext);
        startCounting();
        readBitrate();
        break;
      case 'rendition_change':
        // Close the window at the switch so the time on the old rendition is weighted with its bitrate.
        flushCounted(windowBitrate);
        stateMachine.dispatch({ type: 'renditionchange', bitrate: readBitrate() }, captureContext);
        break;
      case 'pause':
        stopCounting();
        stateMachine.dispatch({ type: 'pause' }, captureContext);
        break;
      case 'timeupdate':
        onTick();
        break;
      case 'seeking': {
        // A drag sends several `seeking`s; only the first sees whether playback was running.
        if (playedTime.isCounting) resumeCountingAfterSeek = true;
        const fromMs = stopCountingAtJump();
        checkSessionRotation();
        stateMachine.dispatch({ type: 'seeking', fromPositionMs: fromMs }, captureContext);
        break;
      }
      case 'seeked': {
        const toMs = currentTimeMsOrZero();
        playedTime.position = toMs;
        stateMachine.dispatch({ type: 'seeked', toPositionMs: toMs }, captureContext);
        if (resumeCountingAfterSeek) startCounting();
        resumeCountingAfterSeek = false;
        break;
      }
      case 'waiting':
        stopCounting();
        stateMachine.dispatch({ type: 'waiting' }, captureContext);
        // Report the stall once it has lasted the minimum; a shorter one is dropped when it closes.
        clock.schedule(() => {
          try {
            stateMachine.dispatch({ type: 'rebuffer_check' }, captureContext);
          } catch (err) {
            internalError(err);
          }
        }, ANALYTICS_MIN_REBUFFER_MS);
        break;
      case 'ended':
        stopCounting();
        stateMachine.dispatch({ type: 'ended' }, captureContext);
        break;
      case 'error':
        stopCounting();
        dispatchError(sig.error, 'native');
        break;
      case 'dispose':
        stopCounting();
        stateMachine.dispatch({ type: 'dispose' }, captureContext);
        batchQueue.dispose();
        unsubscribeLifecycle();
        break;
    }
  };

  // Count the time played so far, emit the closing event if any, then ship: the rows these steps
  // add go out in the same flush. Each step is isolated so a failure still ships what is queued.
  const onLifecycle = (beforeFlush: () => void, reason: 'visibility_hidden' | 'pagehide') => (): void => {
    try {
      beforeFlush();
    } catch (err) {
      internalError(err);
    }
    try {
      batchQueue.flush(reason);
    } catch (err) {
      internalError(err);
    }
  };
  const unsubscribeLifecycle = platform.lifecycle.subscribe({
    // A hidden tab may be discarded without another signal.
    onHidden: onLifecycle(() => flushCounted(), 'visibility_hidden'),
    onUnload: onLifecycle(() => {
      flushCounted();
      stateMachine.dispatch({ type: 'page_hide' }, captureContext);
    }, 'pagehide'),
    onSuspend: onLifecycle(() => {
      flushCounted();
      stateMachine.dispatch({ type: 'page_suspend' }, captureContext);
    }, 'pagehide'),
  });

  const unsubscribe = player.subscribe((sig) => {
    try {
      onSignal(sig);
    } catch (err) {
      internalError(err);
    }
  });

  return {
    reportError(error: AnalyticsErrorInfo) {
      try {
        if (!error || typeof error !== 'object') return;
        const code = String(error.code ?? 'UNKNOWN');
        const message = typeof error.message === 'string' ? error.message : undefined;
        const errContext = typeof error.context === 'string' ? error.context : undefined;
        dispatchError({ code, message, context: errContext }, 'report');
      } catch (err) {
        internalError(err);
      }
    },
    setCustomDimensions(dims: Record<string, string>) {
      try {
        // Context travels per batch, so ship queued events before their dimensions change.
        batchQueue.flush('manual');
        context.custom_dimensions = sanitizeCustomDimensions(dims, warn);
      } catch (err) {
        internalError(err);
      }
    },
    getCustomDimensions() {
      return { ...context.custom_dimensions };
    },
    dispose() {
      try {
        // Same as the player's dispose signal: apps often tear the tracker down without one.
        onSignal({ type: 'dispose' });
      } catch (err) {
        internalError(err);
      }
      unsubscribe();
    },
  };
}
