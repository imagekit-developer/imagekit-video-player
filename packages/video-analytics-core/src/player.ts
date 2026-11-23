export interface AnalyticsErrorInfo {
  code: string;
  message?: string;
  context?: string;
}

export type PlayerSignal =
  | { type: 'player_ready' }
  /**
   * `sourceUrl` is the URL being played, reported on every row. `sourceKey` identifies the source
   * the app asked for; a new view is a video change when it differs. Defaults to `sourceUrl`.
   */
  | { type: 'load_start'; sourceUrl: string; sourceKey?: string }
  | { type: 'play' }
  | { type: 'playing' }
  | { type: 'pause' }
  | { type: 'timeupdate' }
  | { type: 'seeking' }
  | { type: 'seeked' }
  | { type: 'waiting' }
  /** A different rendition is on screen (e.g. the decoded frame size changed). */
  | { type: 'rendition_change' }
  | { type: 'ended' }
  | { type: 'error'; error: AnalyticsErrorInfo }
  | { type: 'dispose' };

/** Point-in-time playback readings. Times are in seconds, as players report them. */
export interface PlaybackSnapshot {
  videoWidth?: number;
  videoHeight?: number;
  duration?: number;
  upscalePercentage?: number;
  downscalePercentage?: number;
  audioCodec?: string;
  videoCodec?: string;
}

/** Rendered player box (not the video resolution) and startup settings. */
export interface PlayerUiContext {
  width?: number;
  height?: number;
  autoplay?: boolean;
  preload?: string;
}

/**
 * Binding between one concrete player (Video.js, Media3, AVPlayer, react-native-video …)
 * and the tracker. Signals must already be de-noised: no pause emitted while seeking. Forward
 * every `seeking` of a drag; the tracker counts them as one seek, timed from the last.
 */
export interface AnalyticsPlayer {
  readonly software: string;
  readonly softwareVersion: string;
  subscribe(listener: (signal: PlayerSignal) => void): () => void;
  getUiContext(): PlayerUiContext;
  getSnapshot(): PlaybackSnapshot;
  getCurrentTime(): number | undefined;
  /** Playback speed, 1 = normal. */
  getPlaybackRate(): number | undefined;
  /** Bits per second of the rendition on screen, which can lag the one being downloaded. */
  getBitrate(): number | undefined;
  /** Drop per-source detections (codecs, bitrate) because a new source is loading. */
  resetSourceState(): void;
}
