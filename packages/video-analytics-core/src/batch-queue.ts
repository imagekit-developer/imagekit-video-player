/**
 * Batches analytics events and flushes to ingest server.
 * Size-based flush trigger is a heuristic to keep URLs under typical browser/server limits;
 * it does not strictly guarantee compliance, especially without gzip.
 */
import type { IKAnalyticsIngestRequest, IKAnalyticsEvent, IKAnalyticsClientContext } from './types';
import type { AnalyticsClock, AnalyticsTransport } from './platform';
import { toSlimEvent } from './event-row-encoder';
import { buildIngestRequestV1 } from './wire-format-v1';
import { scheduleRepeating } from './timers';
import { ANALYTICS_RAW_JSON_FLUSH_THRESHOLD, ANALYTICS_URL_SAFE_LIMIT_BYTES } from './constants';

export type FlushReason = IKAnalyticsIngestRequest['flush_reason'];

export interface BatchQueueOptions {
  ingestUrl: string;
  flushIntervalMs: number;
  maxBatchSize: number;
  transport: AnalyticsTransport;
  debugLog: (message: string, data?: unknown) => void;
  onInternalError: (err: unknown) => void;
  clock: AnalyticsClock;
}

export interface BatchQueue {
  push: (event: IKAnalyticsEvent, context: IKAnalyticsClientContext) => void;
  flush: (reason: FlushReason) => void;
  dispose: () => void;
}

export function createBatchQueue(opts: BatchQueueOptions): BatchQueue {
  const { ingestUrl, flushIntervalMs, maxBatchSize, transport, debugLog, onInternalError, clock } = opts;
  // Without gzip, base64url expands the payload by ~4/3, so the raw-JSON ceiling must be tighter.
  const rawFlushThreshold = transport.supportsCompression
    ? ANALYTICS_RAW_JSON_FLUSH_THRESHOLD
    : Math.floor(ANALYTICS_URL_SAFE_LIMIT_BYTES / 1.37);
  const events: IKAnalyticsEvent[] = [];
  let lastContext: IKAnalyticsClientContext | null = null;
  let stopInterval: (() => void) | null = null;
  let disposed = false;

  function doFlush(reason: FlushReason) {
    if (events.length === 0 || !lastContext) return;
    if (disposed && reason !== 'dispose' && reason !== 'pagehide' && reason !== 'visibility_hidden') return;
    const batch = events.splice(0, events.length);
    const slim = batch.map(toSlimEvent);
    const req = buildIngestRequestV1(lastContext, slim, reason ?? '', undefined, clock.now());
    transport.send(req, { ingestUrl }).then(
      (sent) =>
        debugLog(
          `beacon ${req.r}: ${req.e.length} events, ${sent.jsonBytes} B JSON → ${sent.urlBytes} B URL` +
            (sent.gzipped ? ' (gzip)' : ' (uncompressed)')
        ),
      (err) => debugLog(`beacon ${req.r} failed`, err)
    );
  }

  function projectedBatchJsonLength(): number {
    if (!lastContext || events.length === 0) return 0;
    const slim = events.map(toSlimEvent);
    const req = buildIngestRequestV1(lastContext, slim, 'size_limit', undefined, clock.now());
    return JSON.stringify(req).length;
  }

  function push(event: IKAnalyticsEvent, context: IKAnalyticsClientContext) {
    if (disposed) return;
    lastContext = context;
    events.push(event);

    if (events.length >= maxBatchSize) {
      doFlush('buffer_full');
      return;
    }

    if (projectedBatchJsonLength() >= rawFlushThreshold) {
      doFlush('size_limit');
    }
  }

  function flush(reason: FlushReason) {
    doFlush(reason);
  }

  function guarded(fn: () => void): void {
    try {
      fn();
    } catch (err) {
      onInternalError(err);
    }
  }


  function dispose() {
    if (disposed) return;
    // Flush BEFORE marking disposed so doFlush actually sends.
    flush('dispose');
    disposed = true;
    stopInterval?.();
    stopInterval = null;
  }

  stopInterval = scheduleRepeating(
    clock,
    () => guarded(() => {
      if (events.length > 0) doFlush('interval');
    }),
    flushIntervalMs
  );

  return {
    push,
    flush,
    dispose,
  };
}
