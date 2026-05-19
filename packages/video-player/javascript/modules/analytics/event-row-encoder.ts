/**
 * Converts internal analytics events into wire-format rows for ingest.
 * Ensures session_start_date, event_order, previous_event, ms_from_previous_event are correct.
 */
import type {
  IKAnalyticsEvent,
  IKAnalyticsEventBase,
  IKAnalyticsEventName,
  IKAnalyticsClientContext,
  IKAnalyticsIngestRequest,
  IKAnalyticsEventSlim,
  InternalAnalyticsEvent,
  VideoSourceType,
} from './types';

const VIDEO_SOURCE_TYPES: VideoSourceType[] = ['hls', 'dash', 'mp4', 'webm', 'other'];
const CUSTOM_DATA_KEYS = [
  'custom_data_1',
  'custom_data_2',
  'custom_data_3',
  'custom_data_4',
  'custom_data_5',
  'custom_data_6',
  'custom_data_7',
  'custom_data_8',
  'custom_data_9',
  'custom_data_10',
] as const;

function deriveVideoSourceType(url: string): VideoSourceType {
  const lower = url.toLowerCase();
  if (lower.includes('.m3u8') || lower.includes('m3u8')) return 'hls';
  if (lower.includes('.mpd') || lower.includes('mpd')) return 'dash';
  if (lower.includes('.mp4')) return 'mp4';
  if (lower.includes('.webm')) return 'webm';
  return 'other';
}

function deriveHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

function deriveOrientation(width: number, height: number): 'landscape' | 'portrait' | 'square' | 'unknown' {
  if (!width || !height) return 'unknown';
  if (width > height) return 'landscape';
  if (height > width) return 'portrait';
  return 'square';
}

function assertNever(x: never): never {
  throw new Error(`Unsupported analytics event: ${String(x)}`);
}

export function encodeEvent(
  internal: InternalAnalyticsEvent,
  context: IKAnalyticsClientContext,
  playbackId: string | null,
  eventOrder: number,
  previousEvent: IKAnalyticsEventName | null,
  msFromPrevious: number
): IKAnalyticsEvent {
  const eventTime = new Date().toISOString();
  const base: IKAnalyticsEventBase = {
    event_time_iso: eventTime,
    session_start_date: context.session_start_date,
    imagekit_id: context.imagekit_id,
    session_id: context.session_id,
    player_instance_id: context.player_instance_id,
    event_order: eventOrder,
    event_id: internal.event_id,
    previous_event: previousEvent ?? undefined,
    ms_from_previous_event: msFromPrevious,
  };
  if (playbackId) base.playback_id = playbackId;

  if (internal.video_source_url) {
    base.video_source_url = internal.video_source_url;
    base.video_source_type = internal.video_source_type ?? deriveVideoSourceType(internal.video_source_url);
    base.video_source_hostname = deriveHostname(internal.video_source_url);
  }
  if (internal.video_width_pixels != null) base.video_width_pixels = internal.video_width_pixels;
  if (internal.video_height_pixels != null) base.video_height_pixels = internal.video_height_pixels;
  if (internal.video_total_duration_ms != null) base.video_total_duration_ms = internal.video_total_duration_ms;
  if (internal.orientation != null) base.orientation = internal.orientation;
  else if (
    internal.video_width_pixels != null &&
    internal.video_height_pixels != null
  ) {
    base.orientation = deriveOrientation(internal.video_width_pixels, internal.video_height_pixels);
  }

  if (internal.video_startup_time_ms != null) base.video_startup_time_ms = internal.video_startup_time_ms;
  if (internal.page_load_time_ms != null) base.page_load_time_ms = internal.page_load_time_ms;
  if (internal.player_startup_time_ms != null) base.player_startup_time_ms = internal.player_startup_time_ms;
  if (internal.playback_time_instant_ms != null) base.playback_time_instant_ms = internal.playback_time_instant_ms;
  if (internal.playing_time_ms != null) base.playing_time_ms = internal.playing_time_ms;
  if (internal.video_upscale_percentage != null) base.video_upscale_percentage = internal.video_upscale_percentage;
  if (internal.video_downscale_percentage != null) base.video_downscale_percentage = internal.video_downscale_percentage;
  if (internal.bitrate != null) base.bitrate = internal.bitrate;
  if (internal.audio_codec) base.audio_codec = internal.audio_codec;
  if (internal.video_codec) base.video_codec = internal.video_codec;

  if (internal.from_position_ms != null) base.from_position_ms = internal.from_position_ms;
  if (internal.to_position_ms != null) base.to_position_ms = internal.to_position_ms;
  if (internal.seek_time_ms != null) base.seek_time_ms = internal.seek_time_ms;

  if (internal.rebuffer_duration_ms != null) base.rebuffer_duration_ms = internal.rebuffer_duration_ms;

  if (internal.error_code) base.error_code = internal.error_code;
  if (internal.error_message) base.error_message = internal.error_message;
  if (internal.error_context) base.error_context = internal.error_context;

  if (internal.played_delta_ms != null) base.played_delta_ms = internal.played_delta_ms;
  if (internal.view_end_reason) base.view_end_reason = internal.view_end_reason;
  if (internal.new_video_source_url) base.new_video_source_url = internal.new_video_source_url;
  if (internal.next_playback_id) base.next_playback_id = internal.next_playback_id;

  for (const key of CUSTOM_DATA_KEYS) {
    if (internal[key] != null) {
      base[key] = internal[key];
    }
  }

  switch (internal.event) {
    case 'viewstarted':
      return {
        ...base,
        event: 'viewstarted',
        playback_id: base.playback_id ?? '',
        video_startup_time_ms: base.video_startup_time_ms ?? 0,
      };
    case 'seeking':
      return {
        ...base,
        event: 'seeking',
        playback_id: base.playback_id ?? '',
        from_position_ms: base.from_position_ms ?? 0,
      };
    case 'seeked':
      return {
        ...base,
        event: 'seeked',
        playback_id: base.playback_id ?? '',
        to_position_ms: base.to_position_ms ?? 0,
        seek_time_ms: base.seek_time_ms ?? 0,
      };
    case 'rebufferend':
      return {
        ...base,
        event: 'rebufferend',
        playback_id: base.playback_id ?? '',
        rebuffer_duration_ms: base.rebuffer_duration_ms ?? 0,
      };
    case 'error':
      return {
        ...base,
        event: 'error',
        playback_id: base.playback_id ?? '',
        error_code: base.error_code ?? 'UNKNOWN',
      };
    case 'timeupdate':
      return {
        ...base,
        event: 'timeupdate',
        playback_id: base.playback_id ?? '',
        playback_time_instant_ms: base.playback_time_instant_ms ?? 0,
        playing_time_ms: base.playing_time_ms ?? 0,
        played_delta_ms: base.played_delta_ms ?? 0,
      };
    case 'viewend':
      return {
        ...base,
        event: 'viewend',
        playback_id: base.playback_id ?? '',
        view_end_reason: base.view_end_reason ?? 'navigation',
      };
    case 'sessioninit':
      return { ...base, event: 'sessioninit' };
    case 'playerready':
      return {
        ...base,
        event: 'playerready',
        page_load_time_ms: base.page_load_time_ms ?? 0,
        player_startup_time_ms: base.player_startup_time_ms ?? 0,
      };
    case 'viewinit':
      return { ...base, event: 'viewinit', playback_id: base.playback_id ?? '' };
    case 'videochange':
      return { ...base, event: 'videochange', playback_id: base.playback_id ?? '' };
    case 'play':
      return { ...base, event: 'play', playback_id: base.playback_id ?? '' };
    case 'playing':
      return { ...base, event: 'playing', playback_id: base.playback_id ?? '' };
    case 'pause':
      return { ...base, event: 'pause', playback_id: base.playback_id ?? '' };
    case 'rebufferstart':
      return { ...base, event: 'rebufferstart', playback_id: base.playback_id ?? '' };
    case 'ended':
      return { ...base, event: 'ended', playback_id: base.playback_id ?? '' };
    default:
      return assertNever(internal.event);
  }
}

const CONTEXT_ONLY_KEYS: (keyof IKAnalyticsEvent)[] = [
  'imagekit_id',
  'session_id',
  'player_instance_id',
  'session_start_date',
];

export function toSlimEvent(event: IKAnalyticsEvent): IKAnalyticsEventSlim {
  const slim = { ...event };
  for (const key of CONTEXT_ONLY_KEYS) delete slim[key];
  return slim as IKAnalyticsEventSlim;
}

export function buildIngestRequest(
  schemaVersion: 1,
  context: IKAnalyticsClientContext,
  events: IKAnalyticsEvent[],
  flushReason?: IKAnalyticsIngestRequest['flush_reason']
): IKAnalyticsIngestRequest {
  return {
    schema_version: schemaVersion,
    batch_id: `b_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    sent_at_iso: new Date().toISOString(),
    context,
    events: events.map(toSlimEvent),
    flush_reason: flushReason,
  };
}
