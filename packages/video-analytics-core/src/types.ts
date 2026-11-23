/**
 * Analytics types for ImageKit video player.
 * Aligned with ClickHouse schema (session, player, event) and ingest contract.
 */

export type IKAnalyticsEventName =
  | 'sessioninit'
  | 'playerready'
  | 'viewinit'
  | 'viewstarted'
  | 'videochange'
  | 'play'
  | 'playing'
  | 'pause'
  | 'timeupdate'
  | 'seeking'
  | 'seeked'
  | 'rebufferstart'
  | 'rebufferend'
  | 'renditionchange'
  | 'error'
  | 'ended'
  | 'viewend';

export type VideoSourceType = 'hls' | 'dash' | 'mp4' | 'webm' | 'other';

export type ViewEndReason = 'videochange' | 'error' | 'dispose' | 'navigation' | 'sessionrotate';

export interface IKAnalyticsClientContext {
  imagekit_id: string;
  session_id: string;
  player_instance_id: string;
  user_id?: string;
  page_url: string;
  device_display_width: number;
  device_display_height: number;
  device_display_dpr: number;
  user_agent: string;
  session_start_date: string; // YYYY-MM-DD
  session_start_time_iso?: string;
  player_height_pixels?: number;
  player_width_pixels?: number;
  player_autoplay?: boolean;
  player_preload?: string;
  player_software?: string;
  player_software_version?: string;
  imagekit_plugin?: string;
  imagekit_plugin_version?: string;
  /**
   * Per-session custom dimensions, keyed by slot code (`cd_1`, `cd_2`, …).
   * Slot codes are allocated in the dashboard (Settings → Video Analytics →
   * Custom Dimensions). Stored verbatim on the server in the matching slot.
   */
  custom_dimensions?: Record<string, string>;
  /** `navigator.webdriver`; only sent when true (browser driven by automation). */
  webdriver?: boolean;
}

/**
 * One event as the state machine emits it. Field names are the wire names (`EVENT_FIELDS_V1`);
 * empty strings and missing values are sent as null.
 */
export interface AnalyticsEvent {
  event: IKAnalyticsEventName;
  event_id: string;
  playback_id: string;
  previous_playback_id?: string;
  previous_session_id?: string;
  video_source_url?: string;
  video_width_pixels?: number;
  video_height_pixels?: number;
  video_total_duration_ms?: number;
  video_startup_time_ms?: number;
  page_load_time_ms?: number;
  player_startup_time_ms?: number;
  playback_time_instant_ms?: number;
  playing_time_ms?: number;
  video_upscale_percentage?: number;
  video_downscale_percentage?: number;
  bitrate?: number;
  audio_codec?: string;
  video_codec?: string;
  from_position_ms?: number;
  to_position_ms?: number;
  seek_time_ms?: number;
  rebuffer_duration_ms?: number;
  error_code?: string;
  error_message?: string;
  error_context?: string;
  played_delta_ms?: number;
  view_end_reason?: ViewEndReason;
  new_video_source_url?: string;
  next_playback_id?: string;
  /** Position of the event in its view, from 1. */
  event_order: number;
  previous_event?: IKAnalyticsEventName;
  ms_from_previous_event: number;
}

export type FlushReason =
  | 'interval'
  | 'visibility_hidden'
  | 'pagehide'
  | 'manual'
  | 'dispose'
  | 'size_limit'
  | 'buffer_full';
