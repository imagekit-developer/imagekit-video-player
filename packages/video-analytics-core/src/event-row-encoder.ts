/**
 * Converts internal analytics events into wire-format rows for ingest.
 */
import type {
  IKAnalyticsEvent,
  IKAnalyticsEventBase,
  IKAnalyticsEventName,
  IKAnalyticsClientContext,
  IKAnalyticsEventSlim,
  InternalAnalyticsEvent,
  VideoSourceType,
} from './types';

const VIDEO_SOURCE_TYPES: VideoSourceType[] = ['hls', 'dash', 'mp4', 'webm', 'other'];

/** From the file extension of the URL path; manifests without one (e.g. `manifest(format=…)`) are `other`. */
function deriveVideoSourceType(url: string): VideoSourceType {
  const path = url.split(/[?#]/, 1)[0].toLowerCase();
  if (path.endsWith('.m3u8')) return 'hls';
  if (path.endsWith('.mpd')) return 'dash';
  if (path.endsWith('.mp4')) return 'mp4';
  if (path.endsWith('.webm')) return 'webm';
  return 'other';
}

function assertNever(x: never): never {
  throw new Error(`Unsupported analytics event: ${String(x)}`);
}

export function encodeEvent(
  internal: InternalAnalyticsEvent,
  context: IKAnalyticsClientContext,
  playbackId: string | null,
  eventTimeMs: number
): IKAnalyticsEvent {
  const base: IKAnalyticsEventBase = {
    event_time_iso: new Date(eventTimeMs).toISOString(),
    session_start_date: context.session_start_date,
    imagekit_id: context.imagekit_id,
    session_id: context.session_id,
    player_instance_id: context.player_instance_id,
    event_order: internal.event_order,
    event_id: internal.event_id,
    previous_event: internal.previous_event,
    ms_from_previous_event: internal.ms_from_previous_event,
  };
  if (playbackId) base.playback_id = playbackId;

  if (internal.video_source_url) {
    base.video_source_url = internal.video_source_url;
    base.video_source_type = internal.video_source_type ?? deriveVideoSourceType(internal.video_source_url);
  }
  if (internal.video_width_pixels != null) base.video_width_pixels = internal.video_width_pixels;
  if (internal.video_height_pixels != null) base.video_height_pixels = internal.video_height_pixels;
  if (internal.video_total_duration_ms != null) base.video_total_duration_ms = internal.video_total_duration_ms;

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
  // Predecessor links stamped by the state machine on every event of a non-cold-start view.
  // Empty strings are omitted so the wire row stays compact for cold-start playbacks.
  if (internal.previous_playback_id) base.previous_playback_id = internal.previous_playback_id;
  if (internal.previous_session_id) base.previous_session_id = internal.previous_session_id;

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
    case 'renditionchange':
      return { ...base, event: 'renditionchange', playback_id: base.playback_id ?? '' };
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
