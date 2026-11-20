/**
 * Binds a Video.js player to the analytics core: maps player events to normalized
 * signals and exposes playback readings (time, bitrate, codecs, rendered size).
 */
import type Player from 'video.js/dist/types/player';
import type { AnalyticsPlayer, PlayerSignal, AnalyticsErrorInfo } from '@imagekit/video-analytics-core';
import type { SourceOptions } from '../../interfaces';
import { computeVideoUpDownScalePercentages } from './video-scale-percentage';
import { version as VIDEOJS_VERSION } from 'video.js/package.json';

function toErrorInfo(err: unknown): AnalyticsErrorInfo {
  if (!err || typeof err !== 'object') return { code: 'UNKNOWN' };
  const e = err as { code?: number; message?: string; status?: number };
  let context: string | undefined;
  try {
    context = JSON.stringify(err);
  } catch {
    context = undefined;
  }
  return {
    code: String(e.code ?? e.status ?? 'UNKNOWN'),
    message: typeof e.message === 'string' ? e.message : undefined,
    context,
  };
}

export function createVideoJsAnalyticsPlayer(
  player: Player,
  getCurrentSource: () => SourceOptions | null
): AnalyticsPlayer {
  const playerAny = player as any;
  let loadSource: SourceOptions | null = null;
  let announcedSource: SourceOptions | null = null;
  let lastLoadStartSource: SourceOptions | null = null;
  let progressiveBitrateBps: number | undefined;
  let detectedVideoCodec: string | undefined;
  let detectedAudioCodec: string | undefined;
  // Incremented per source so late one-time media listeners from a previous
  // source can detect they've been superseded and skip writing stale data.
  let loadGeneration = 0;

  const videoEl = () => player.el()?.querySelector('video') as HTMLVideoElement | null | undefined;

  // The selected quality level is what VHS downloads, which can lead the screen by seconds; match
  // the decoded frame height to a level instead. Renditions are assumed to have unique heights.
  function onScreenBitrate(): number | undefined {
    try {
      const height = videoEl()?.videoHeight;
      const ql = playerAny.qualityLevels?.();
      for (let i = 0; height && ql && i < ql.length; i++) {
        if (ql[i]?.height === height) return ql[i].bitrate;
      }
    } catch {
      /* ignore */
    }
    return undefined;
  }

  function selectedLevelBitrate(): number | undefined {
    try {
      const ql = playerAny.qualityLevels?.();
      const selected = ql && typeof ql.selectedIndex === 'number' ? ql[ql.selectedIndex] : undefined;
      if (selected?.height) return selected.bitrate;
    } catch {
      /* ignore */
    }
    return undefined;
  }

  function subscribe(onSignal: (signal: PlayerSignal) => void): () => void {
    const offs: Array<() => void> = [];
    const on = (event: string, handler: (...args: any[]) => void) => {
      player.on(event, handler);
      offs.push(() => player.off(event, handler));
    };

    on('ready', () => onSignal({ type: 'player_ready' }));

    let renderedBitrate: number | undefined;

    // The source handler holds a play() requested while it prepares the source. The view opens
    // and video startup time starts at that request, so the source's later loadstart and the
    // held play's own `play` event are not reported a second time.
    let heldPlaySent = false;
    const announceLoadStart = (sourceUrl: string | undefined) => {
      const source = getCurrentSource();
      if (source === announcedSource) return;
      announcedSource = source;
      renderedBitrate = undefined;
      loadSource = source;
      onSignal({ type: 'load_start', sourceUrl: sourceUrl || source?.src || '' });
    };
    on('ikplayheld', (_event: unknown, data?: { sourceUrl?: string }) => {
      announceLoadStart(data?.sourceUrl);
      heldPlaySent = true;
      onSignal({ type: 'play' });
    });
    // Preparing the source failed before Video.js saw it: open its view so the error belongs to it.
    on('iksourcefailed', (_event: unknown, data?: { sourceUrl?: string }) => {
      if (getCurrentSource() !== lastLoadStartSource) announceLoadStart(data?.sourceUrl);
    });
    on('ikplaycancel', () => {
      heldPlaySent = false;
      onSignal({ type: 'pause' });
    });

    on('loadstart', () => {
      renderedBitrate = undefined;
      loadSource = getCurrentSource();
      const announced = announcedSource !== null && loadSource === announcedSource;
      announcedSource = null;
      lastLoadStartSource = loadSource;
      if (announced) {
        resetSourceState();
        return;
      }
      heldPlaySent = false;
      onSignal({ type: 'load_start', sourceUrl: player.currentSrc?.() || loadSource?.src || '' });
    });

    on('play', () => {
      if (heldPlaySent) {
        heldPlaySent = false;
        return;
      }
      onSignal({ type: 'play' });
    });
    on('playing', () => onSignal({ type: 'playing' }));

    on('pause', () => {
      // HTML5 video may pause internally while seeking, and Video.js' scrub behavior
      // calls pause()/play() around drags. Neither is user intent to pause.
      if (playerAny.seeking?.() || playerAny.scrubbing?.()) return;
      onSignal({ type: 'pause' });
    });

    on('timeupdate', () => onSignal({ type: 'timeupdate' }));

    on('seeking', () => onSignal({ type: 'seeking' }));
    on('seeked', () => onSignal({ type: 'seeked' }));

    on('waiting', () => onSignal({ type: 'waiting' }));

    // The decoded frame size changed: a different rendition is on screen.
    on('resize', () => {
      const bitrate = onScreenBitrate();
      if (bitrate === renderedBitrate) return;
      const isSwitch = renderedBitrate !== undefined;
      renderedBitrate = bitrate;
      if (isSwitch) onSignal({ type: 'rendition_change' });
    });
    on('ended', () => onSignal({ type: 'ended' }));
    on('error', () => {
      heldPlaySent = false;
      onSignal({ type: 'error', error: toErrorInfo(player.error()) });
    });
    on('dispose', () => onSignal({ type: 'dispose' }));

    return () => offs.forEach((off) => off());
  }

  function resetSourceState(): void {
    progressiveBitrateBps = undefined;
    detectedVideoCodec = undefined;
    detectedAudioCodec = undefined;
    loadGeneration += 1;
    const generation = loadGeneration;
    const srcUrl = loadSource?.src ?? '';

    // Progressive sources have no quality levels; estimate bitrate from Content-Length + duration.
    if (!loadSource?.abs && srcUrl) {
      player.one('loadedmetadata', () => {
        if (generation !== loadGeneration) return;
        const dur = player.duration();
        if (typeof dur !== 'number' || !isFinite(dur) || dur <= 0) return;
        fetch(srcUrl, { method: 'HEAD' })
          .then((res) => {
            if (generation !== loadGeneration) return;
            const cl = res.headers.get('content-length');
            if (cl) {
              const bytes = parseInt(cl, 10);
              if (bytes > 0) progressiveBitrateBps = Math.round((bytes * 8) / dur);
            }
          })
          .catch(() => { /* ignore – CORS or network failure */ });
      });
    }

    // HLS/DASH codecs are known once the first segment is transmuxed.
    player.one('canplay', () => {
      if (generation !== loadGeneration) return;
      try {
        const tech = playerAny.tech?.(true);
        const vhs = tech?.vhs ?? tech?.hls;
        if (vhs) {
          const pc = vhs.playlistController_ ?? vhs.masterPlaylistController_;
          const codecs = pc?.sourceUpdater_?.codecs;
          if (codecs && typeof codecs === 'object') {
            if (codecs.video) detectedVideoCodec = codecs.video;
            if (codecs.audio) detectedAudioCodec = codecs.audio;
          }
        }
      } catch { /* ignore */ }
    });
  }

  return {
    software: 'video.js',
    softwareVersion: VIDEOJS_VERSION,
    subscribe,
    resetSourceState,

    getUiContext() {
      const rect = player.el?.()?.getBoundingClientRect?.();
      const autoplay = typeof playerAny.autoplay === 'function' ? playerAny.autoplay() : undefined;
      const preload = typeof playerAny.preload === 'function' ? playerAny.preload() : undefined;
      return {
        width: rect?.width,
        height: rect?.height,
        autoplay: typeof autoplay === 'boolean' ? autoplay : undefined,
        preload: typeof preload === 'string' ? preload : undefined,
      };
    },

    getSnapshot() {
      const el = videoEl();
      const scale = computeVideoUpDownScalePercentages(el);
      return {
        videoWidth: el?.videoWidth,
        videoHeight: el?.videoHeight,
        duration: player.duration(),
        upscalePercentage: scale.video_upscale_percentage,
        downscalePercentage: scale.video_downscale_percentage,
        audioCodec: detectedAudioCodec,
        videoCodec: detectedVideoCodec,
      };
    },

    getCurrentTime() {
      return player.currentTime();
    },

    getPlaybackRate() {
      return player.playbackRate();
    },

    getBitrate() {
      return onScreenBitrate() ?? selectedLevelBitrate() ?? progressiveBitrateBps;
    },
  };
}
