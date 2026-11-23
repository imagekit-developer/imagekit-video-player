/**
 * V1 analytics wire format — single source of truth for positional event rows + short context keys.
 * Mirror copy lives in video-analytics-ingest-server/internal/wire.
 * Field order and key map MUST stay in lockstep with that file.
 *
 * Design notes:
 *  - `orientation` and `video_source_hostname` are derived server-side from video_source_url + w/h.
 *  - `error_context` is truncated to 512 B at encode time.
 */
import type { AnalyticsEvent, FlushReason, IKAnalyticsClientContext, VideoSourceType } from './types';

export const WIRE_VERSION = 1;

/**
 * Ordered positions for an event row on the wire.
 * Trailing nulls are trimmed by encoder; decoder pads missing positions with null.
 * NEVER reorder or insert; only append (and bump WIRE_VERSION for breaking changes).
 */
export const EVENT_FIELDS_V1 = [
  'event_time',                  // 0  — ms epoch (number)
  'event_order',                 // 1
  'event_id',                    // 2
  'event',                       // 3  — IKAnalyticsEventName
  'previous_event',              // 4
  'ms_from_previous_event',      // 5
  'playback_id',                 // 6
  'video_source_url',            // 7
  'video_source_type',           // 8
  'video_width_pixels',          // 9
  'video_height_pixels',         // 10
  'video_total_duration_ms',     // 11
  'playback_time_instant_ms',    // 12
  'playing_time_ms',             // 13
  'video_upscale_percentage',    // 14
  'video_downscale_percentage',  // 15
  'from_position_ms',            // 16
  'to_position_ms',              // 17
  'seek_time_ms',                // 18
  'bitrate',                     // 19
  'played_delta_ms',             // 20
  'rebuffer_duration_ms',        // 21
  'error_code',                  // 22
  'error_message',               // 23
  'view_end_reason',             // 24
  'new_video_source_url',        // 25
  'next_playback_id',            // 26
  'video_startup_time_ms',       // 27
  'player_startup_time_ms',      // 28
  'page_load_time_ms',           // 29
  'audio_codec',                 // 30
  'video_codec',                 // 31
  'error_context',               // 32
  'previous_playback_id',        // 33  — predecessor playback (videochange or warm resume)
  'previous_session_id',         // 34  — predecessor session (warm resume only; gates startup-time MVs server-side)
] as const;

/** Short-key → canonical context field. */
export const CONTEXT_KEY_MAP_V1: Record<string, keyof IKAnalyticsClientContext> = {
  ik: 'imagekit_id',
  s: 'session_id',
  p: 'player_instance_id',
  u: 'user_id',
  url: 'page_url',
  dw: 'device_display_width',
  dh: 'device_display_height',
  dpr: 'device_display_dpr',
  ua: 'user_agent',
  ssd: 'session_start_date',
  sst: 'session_start_time_iso',
  psw: 'player_software',
  psv: 'player_software_version',
  ip: 'imagekit_plugin',
  ipv: 'imagekit_plugin_version',
  pw: 'player_width_pixels',
  ph: 'player_height_pixels',
  pa: 'player_autoplay',
  pp: 'player_preload',
  /**
   * Custom dimensions object keyed by slot code: `{ cd_1: value, cd_2: value }`.
   * Slots are allocated per tenant in the dashboard; the ingest server stores
   * each entry verbatim in the ClickHouse Map column.
   */
  cd: 'custom_dimensions',
  wd: 'webdriver',
};

/** Canonical → short-key (inverse of CONTEXT_KEY_MAP_V1). */
export const CONTEXT_KEY_MAP_V1_INVERSE: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const [short, long] of Object.entries(CONTEXT_KEY_MAP_V1)) {
    out[long] = short;
  }
  return out;
})();

/** Wire-format envelope (what's gzipped + base64url-encoded into ?d=). */
export interface IKAnalyticsIngestRequestV1 {
  v: 1;
  b: string;                        // batch_id
  t: number;                        // sent_at ms epoch
  r: string;                        // flush_reason
  c: Record<string, unknown>;       // context (short keys)
  e: Array<Array<unknown>>;         // positional event rows, trailing nulls trimmed
}

/**
 * Truncates to at most `maxBytes` of UTF-8, cutting only between characters and appending `…`
 * (3 bytes) when truncated. Sizes are computed from char codes, so no encoder is needed.
 */
export function truncateBytes(s: string | undefined, maxBytes: number): string | undefined {
  if (typeof s !== 'string') return undefined;
  const keepBytes = maxBytes - 3;
  let bytes = 0;
  let cut = 0;
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    let size = code < 0x80 ? 1 : code < 0x800 ? 2 : 3;
    const next = s.charCodeAt(i + 1);
    const isSurrogatePair = code >= 0xd800 && code <= 0xdbff && next >= 0xdc00 && next <= 0xdfff;
    if (isSurrogatePair) size = 4;
    bytes += size;
    if (bytes > maxBytes) return s.slice(0, cut) + '…';
    if (isSurrogatePair) i++;
    if (bytes <= keepBytes) cut = i + 1;
  }
  return s;
}

/** Encode canonical context into short-key wire shape, dropping undefined values. */
export function encodeContextV1(context: IKAnalyticsClientContext): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [longKey, value] of Object.entries(context)) {
    if (value === undefined || value === null) continue;
    const shortKey = CONTEXT_KEY_MAP_V1_INVERSE[longKey] ?? longKey;
    out[shortKey] = value;
  }
  return out;
}

/** From the file extension of the URL path; manifests without one (e.g. `manifest(format=…)`) are `other`. */
function deriveVideoSourceType(url: string): VideoSourceType {
  const path = url.split(/[?#]/, 1)[0].toLowerCase();
  if (path.endsWith('.m3u8')) return 'hls';
  if (path.endsWith('.mpd')) return 'dash';
  if (path.endsWith('.mp4')) return 'mp4';
  if (path.endsWith('.webm')) return 'webm';
  return 'other';
}

const EVENT_TIME = EVENT_FIELDS_V1.indexOf('event_time');
const VIDEO_SOURCE_TYPE = EVENT_FIELDS_V1.indexOf('video_source_type');
const ERROR_MESSAGE = EVENT_FIELDS_V1.indexOf('error_message');
const ERROR_CONTEXT = EVENT_FIELDS_V1.indexOf('error_context');

/** Encodes one event into its positional row, trailing nulls trimmed. */
export function encodeEventRowV1(event: AnalyticsEvent, eventTimeMs: number): Array<unknown> {
  const fields = event as unknown as Record<string, unknown>;
  const row: Array<unknown> = EVENT_FIELDS_V1.map((field) => {
    const value = fields[field];
    return value === undefined || value === '' ? null : value;
  });
  row[EVENT_TIME] = Number.isFinite(eventTimeMs) ? Math.trunc(eventTimeMs) : null;
  if (event.video_source_url) row[VIDEO_SOURCE_TYPE] = deriveVideoSourceType(event.video_source_url);
  row[ERROR_MESSAGE] = truncateBytes(event.error_message || undefined, 256) ?? null;
  row[ERROR_CONTEXT] = truncateBytes(event.error_context || undefined, 512) ?? null;

  let len = row.length;
  while (len > 0 && row[len - 1] === null) len--;
  row.length = len;
  return row;
}

/** Builds the v1 envelope around rows already encoded with `encodeEventRowV1`. */
export function buildIngestRequestV1(
  context: IKAnalyticsClientContext,
  rows: Array<Array<unknown>>,
  flushReason: FlushReason,
  sentAtMs: number
): IKAnalyticsIngestRequestV1 {
  return {
    v: WIRE_VERSION,
    b: `b_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    t: sentAtMs,
    r: flushReason,
    c: encodeContextV1(context),
    e: rows,
  };
}
