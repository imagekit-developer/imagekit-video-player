/**
 * V1 analytics wire format — single source of truth for positional event rows + short context keys.
 * Mirror copy lives in video-analytics-ingest-server/internal/wire.
 * Field order and key map MUST stay in lockstep with that file.
 *
 * Design notes:
 *  - `orientation` and `video_source_hostname` are derived server-side from video_source_url + w/h.
 *  - `error_context` is truncated to 512 B at encode time.
 */
import type {
  IKAnalyticsClientContext,
  IKAnalyticsEvent,
  IKAnalyticsEventSlim,
  IKAnalyticsIngestRequest,
} from './types';

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
] as const;

export type EventFieldV1 = (typeof EVENT_FIELDS_V1)[number];

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
   * Custom dimensions object keyed by slot code: `{ cd_01: value, cd_02: value }`.
   * Slots are allocated per tenant in the dashboard; the ingest server stores
   * each entry verbatim in the ClickHouse Map column.
   */
  cd: 'custom_dimensions',
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

/** Truncate string to N bytes (UTF-8 safe). Appends ellipsis when truncated. */
export function truncateBytes(s: string | undefined, maxBytes: number): string | undefined {
  if (s == null) return s;
  if (typeof TextEncoder === 'undefined') {
    // Fallback for environments without TextEncoder — use char length.
    return s.length <= maxBytes ? s : s.slice(0, maxBytes - 1) + '…';
  }
  const enc = new TextEncoder();
  const bytes = enc.encode(s);
  if (bytes.length <= maxBytes) return s;
  // Decode a prefix of bytes safely, leaving room for the ellipsis (3 bytes UTF-8).
  const cut = bytes.slice(0, maxBytes - 3);
  const dec = new TextDecoder('utf-8', { fatal: false });
  return dec.decode(cut) + '…';
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

/** Decode wire-shape context back to canonical (long-key) shape. */
export function decodeContextV1(shortContext: Record<string, unknown>): IKAnalyticsClientContext {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(shortContext)) {
    const longKey = CONTEXT_KEY_MAP_V1[key] ?? key;
    out[longKey] = value;
  }
  return out as unknown as IKAnalyticsClientContext;
}

/** Defensive per-field truncation applied before wire encoding. */
function applyTruncation(ev: IKAnalyticsEventSlim): IKAnalyticsEventSlim {
  let out: IKAnalyticsEventSlim = ev;
  if (out.error_message) {
    const t = truncateBytes(out.error_message, 256);
    if (t !== out.error_message) out = { ...out, error_message: t } as IKAnalyticsEventSlim;
  }
  if (out.error_context) {
    const t = truncateBytes(out.error_context, 512);
    if (t !== out.error_context) out = { ...out, error_context: t } as IKAnalyticsEventSlim;
  }
  return out;
}

/** Encode one slim event into a positional row, with trailing-null trim. */
export function encodeEventRowV1(ev: IKAnalyticsEventSlim): Array<unknown> {
  const truncated = applyTruncation(ev);
  const e = truncated as unknown as Record<string, unknown>;
  const row: Array<unknown> = new Array(EVENT_FIELDS_V1.length);

  for (let i = 0; i < EVENT_FIELDS_V1.length; i++) {
    const field = EVENT_FIELDS_V1[i];
    if (field === 'event_time') {
      // Convert ISO string → ms epoch.
      const iso = e.event_time_iso as string | undefined;
      const t = iso ? Date.parse(iso) : NaN;
      row[i] = Number.isFinite(t) ? t : null;
    } else {
      const v = e[field];
      row[i] = v === undefined ? null : v;
    }
  }

  // Trim trailing nulls.
  let len = row.length;
  while (len > 0 && row[len - 1] === null) len--;
  row.length = len;

  return row;
}

/** Decode a positional row back to the canonical slim-event object. */
export function decodeEventRowV1(row: Array<unknown>): IKAnalyticsEventSlim {
  const out: Record<string, unknown> = {};
  for (let i = 0; i < EVENT_FIELDS_V1.length; i++) {
    const value = i < row.length ? row[i] : null;
    if (value === null || value === undefined) continue;
    const field = EVENT_FIELDS_V1[i];
    if (field === 'event_time') {
      const t = typeof value === 'number' ? value : Number(value);
      if (Number.isFinite(t)) {
        out.event_time_iso = new Date(t).toISOString();
      }
    } else {
      out[field] = value;
    }
  }
  return out as IKAnalyticsEventSlim;
}

/** Build the full v1 wire envelope from canonical inputs. */
export function buildIngestRequestV1(
  context: IKAnalyticsClientContext,
  events: IKAnalyticsEventSlim[] | IKAnalyticsEvent[],
  flushReason: string,
  batchId?: string,
  sentAtMs?: number
): IKAnalyticsIngestRequestV1 {
  return {
    v: WIRE_VERSION,
    b: batchId ?? `b_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    t: sentAtMs ?? Date.now(),
    r: flushReason,
    c: encodeContextV1(context),
    e: (events as IKAnalyticsEventSlim[]).map(encodeEventRowV1),
  };
}

/** Decode a wire envelope back to the canonical IKAnalyticsIngestRequest shape. */
export function decodeIngestRequestV1(raw: IKAnalyticsIngestRequestV1): IKAnalyticsIngestRequest {
  return {
    schema_version: 1,
    batch_id: raw.b,
    sent_at_iso: new Date(raw.t).toISOString(),
    context: decodeContextV1(raw.c),
    events: raw.e.map(decodeEventRowV1) as IKAnalyticsIngestRequest['events'],
    flush_reason: raw.r as IKAnalyticsIngestRequest['flush_reason'],
  };
}
