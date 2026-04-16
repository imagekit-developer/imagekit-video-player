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
  | 'error'
  | 'ended'
  | 'viewend';

export type VideoSourceType = 'hls' | 'dash' | 'mp4' | 'webm' | 'other';

export type Orientation = 'landscape' | 'portrait' | 'square' | 'unknown';

export type ViewEndReason = 'ended' | 'videochange' | 'error' | 'dispose' | 'navigation';

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
  user_agent_data?: unknown;
  language?: string;
  time_zone?: string;
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
}

/**
 * Common fields for all analytics events. Does not include `event` (discriminator).
 * Event-specific required fields are enforced by the union members (e.g. IKViewStartedEvent, IKSeekedEvent).
 */
export interface IKAnalyticsEventBase {
  /** Required on every event */
  event_time_iso: string;
  session_start_date: string;
  playback_id?: string;
  event_order: number;
  event_id: string;
  imagekit_id: string;
  session_id: string;
  player_instance_id: string;

  previous_event?: IKAnalyticsEventName;
  ms_from_previous_event?: number;

  /** Optional payload; required only on specific event types (see union) */
  video_source_url?: string;
  video_source_type?: VideoSourceType;
  video_source_hostname?: string;
  orientation?: Orientation;
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
  custom_data_1?: string;
  custom_data_2?: string;
  custom_data_3?: string;
  custom_data_4?: string;
  custom_data_5?: string;
  custom_data_6?: string;
  custom_data_7?: string;
  custom_data_8?: string;
  custom_data_9?: string;
  custom_data_10?: string;
  played_delta_ms?: number;
  view_end_reason?: ViewEndReason;
  new_video_source_url?: string;
  next_playback_id?: string;
}

type IKEventWithName<TName extends IKAnalyticsEventName, TExtra = {}> =
  IKAnalyticsEventBase &
  { event: TName } &
  TExtra;

type IKPlaybackEventWithName<TName extends IKAnalyticsEventName, TExtra = {}> =
  IKEventWithName<TName, { playback_id: string } & TExtra>;

export type IKSessionInitEvent = IKEventWithName<'sessioninit'>;
export type IKPlayerReadyEvent = IKEventWithName<
  'playerready',
  { page_load_time_ms: number; player_startup_time_ms: number }
>;
export type IKViewInitEvent = IKPlaybackEventWithName<'viewinit'>;
export type IKVideoChangeEvent = IKPlaybackEventWithName<'videochange'>;
export type IKPlayEvent = IKPlaybackEventWithName<'play'>;
export type IKPlayingEvent = IKPlaybackEventWithName<'playing'>;
export type IKPauseEvent = IKPlaybackEventWithName<'pause'>;
export type IKRebufferStartEvent = IKPlaybackEventWithName<'rebufferstart'>;
export type IKEndedEvent = IKPlaybackEventWithName<'ended'>;

export type IKViewStartedEvent = IKPlaybackEventWithName<
  'viewstarted',
  { video_startup_time_ms: number }
>;

export type IKSeekingEvent = IKPlaybackEventWithName<
  'seeking',
  { from_position_ms: number }
>;

export type IKSeekedEvent = IKPlaybackEventWithName<
  'seeked',
  { to_position_ms: number; seek_time_ms: number }
>;

export type IKRebufferEndEvent = IKPlaybackEventWithName<
  'rebufferend',
  { rebuffer_duration_ms: number }
>;

export type IKErrorEvent = IKPlaybackEventWithName<
  'error',
  { error_code: string }
>;

export type IKTimeupdateEvent = IKPlaybackEventWithName<
  'timeupdate',
  {
    playback_time_instant_ms: number;
    playing_time_ms: number;
    played_delta_ms: number;
  }
>;

export type IKViewEndEvent = IKPlaybackEventWithName<
  'viewend',
  { view_end_reason: ViewEndReason }
>;

export type IKAnalyticsEvent =
  | IKSessionInitEvent
  | IKPlayerReadyEvent
  | IKViewInitEvent
  | IKVideoChangeEvent
  | IKPlayEvent
  | IKPlayingEvent
  | IKPauseEvent
  | IKRebufferStartEvent
  | IKEndedEvent
  | IKViewStartedEvent
  | IKSeekingEvent
  | IKSeekedEvent
  | IKRebufferEndEvent
  | IKErrorEvent
  | IKTimeupdateEvent
  | IKViewEndEvent;

/** Internal event shape before encoding to wire format */
export interface InternalAnalyticsEvent {
  event: IKAnalyticsEventName;
  event_id: string;
  video_source_url?: string;
  video_source_type?: VideoSourceType;
  orientation?: Orientation;
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
  ms_from_previous_event?: number;
  custom_data_1?: string;
  custom_data_2?: string;
  custom_data_3?: string;
  custom_data_4?: string;
  custom_data_5?: string;
  custom_data_6?: string;
  custom_data_7?: string;
  custom_data_8?: string;
  custom_data_9?: string;
  custom_data_10?: string;
}

/** Event payload for ingest: context-only fields are omitted (sent in context only). */
export type IKAnalyticsEventSlim = Omit<
  IKAnalyticsEvent,
  'imagekit_id' | 'session_id' | 'player_instance_id' | 'session_start_date'
>;

export interface IKAnalyticsIngestRequest {
  schema_version: 1;
  batch_id?: string;
  sent_at_iso?: string;
  context: IKAnalyticsClientContext;
  events: IKAnalyticsEventSlim[];
  flush_reason?: 'interval' | 'visibility_hidden' | 'pagehide' | 'manual' | 'buffer_full' | 'dispose';
}

export interface AnalyticsConfig {
  ingestUrl: string;
  flushIntervalMs: number;
  maxBatchSize: number;
  timeupdateThrottleMs: number;
  debug?: boolean;
  user_id?: string;
  customDimensions?: Record<string, string>;
}
