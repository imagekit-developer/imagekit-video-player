/**
 * Batches analytics events and flushes to ingest server.
 * v1 transport: flushes as `GET ingestUrl?d=<base64url(gzip(json))>&z=g`.
 * `keepalive` is only set for unload-time flushes (pagehide / visibility_hidden / dispose).
 * Size-based flush trigger is a heuristic to keep URLs under typical browser/server limits;
 * it does not strictly guarantee compliance, especially without CompressionStream support.
 */
import type { IKAnalyticsIngestRequest, IKAnalyticsEvent, IKAnalyticsClientContext } from './types';
import { toSlimEvent } from './event-row-encoder';
import { buildIngestRequestV1 } from './wire-format-v1';
import { sendBatchV1 } from './transport';
import { ANALYTICS_RAW_JSON_FLUSH_THRESHOLD, ANALYTICS_URL_SAFE_LIMIT_BYTES } from './constants';

/** Whether the browser supports CompressionStream (checked once at module load). */
const HAS_COMPRESSION_STREAM = typeof globalThis.CompressionStream !== 'undefined';

/**
 * Effective raw-JSON size threshold for triggering a flush.
 * With compression: use the configured threshold (gzip shrinks well below URL limit).
 * Without compression: base64url expands by ~4/3; apply a tighter ceiling so the final
 * URL stays under the safe byte limit even without gzip.
 */
const EFFECTIVE_RAW_FLUSH_THRESHOLD = HAS_COMPRESSION_STREAM
  ? ANALYTICS_RAW_JSON_FLUSH_THRESHOLD
  : Math.floor(ANALYTICS_URL_SAFE_LIMIT_BYTES / 1.37);

export type FlushReason = IKAnalyticsIngestRequest['flush_reason'];

export interface BatchQueueOptions {
  ingestUrl: string;
  flushIntervalMs: number;
  maxBatchSize: number;
  debug?: boolean;
}

export interface BatchQueue {
  push: (event: IKAnalyticsEvent, context: IKAnalyticsClientContext) => void;
  flush: (reason: FlushReason) => void;
  dispose: () => void;
}

export function createBatchQueue(opts: BatchQueueOptions): BatchQueue {
  const { ingestUrl, flushIntervalMs, maxBatchSize, debug } = opts;
  const events: IKAnalyticsEvent[] = [];
  let lastContext: IKAnalyticsClientContext | null = null;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let visibilityCleanup: (() => void) | null = null;
  let pagehideCleanup: (() => void) | null = null;
  let disposed = false;

  function doFlush(reason: FlushReason) {
    if (events.length === 0 || !lastContext) return;
    const batch = events.splice(0, events.length);
    const slim = batch.map(toSlimEvent);
    const req = buildIngestRequestV1(lastContext, slim, reason ?? '');
    if (debug) {
      console.log('[IK Analytics] Sending batch', req.r, req.e.length, 'events');
    }
    if (disposed && reason !== 'dispose' && reason !== 'pagehide' && reason !== 'visibility_hidden') return;
    void sendBatchV1(req, { ingestUrl, debug });
  }

  /** Rough projected raw-JSON size of the current batch if flushed now. */
  function projectedBatchJsonLength(): number {
    if (!lastContext || events.length === 0) return 0;
    const slim = events.map(toSlimEvent);
    const req = buildIngestRequestV1(lastContext, slim, 'size_limit');
    return JSON.stringify(req).length;
  }

  function push(event: IKAnalyticsEvent, context: IKAnalyticsClientContext) {
    if (disposed) return;
    lastContext = context;
    events.push(event);

    // Hard cap on event count.
    if (events.length >= maxBatchSize) {
      doFlush('buffer_full');
      return;
    }

    // Size-based trigger: keep URL safely under the limit.
    if (projectedBatchJsonLength() >= EFFECTIVE_RAW_FLUSH_THRESHOLD) {
      doFlush('size_limit');
    }
  }

  function flush(reason: FlushReason) {
    doFlush(reason);
  }

  function startInterval() {
    if (intervalId) return;
    intervalId = setInterval(() => {
      if (events.length > 0) doFlush('interval');
    }, flushIntervalMs);
  }

  function stopInterval() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  function setupLifecycleListeners() {
    if (typeof document === 'undefined') return;
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flush('visibility_hidden');
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    visibilityCleanup = () => document.removeEventListener('visibilitychange', onVisibilityChange);

    const onPageHide = () => flush('pagehide');
    window.addEventListener('pagehide', onPageHide);
    pagehideCleanup = () => window.removeEventListener('pagehide', onPageHide);
  }

  function dispose() {
    if (disposed) return;
    // Flush remaining events BEFORE marking disposed so doFlush actually sends.
    flush('dispose');
    disposed = true;
    stopInterval();
    visibilityCleanup?.();
    pagehideCleanup?.();
  }

  startInterval();
  setupLifecycleListeners();

  return {
    push,
    flush,
    dispose,
  };
}
