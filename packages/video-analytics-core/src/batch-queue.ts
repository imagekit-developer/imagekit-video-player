/**
 * Batches analytics events and flushes to ingest server.
 * Size-based flush trigger is a heuristic to keep URLs under typical browser/server limits;
 * it does not strictly guarantee compliance, especially without gzip.
 */
import type { FlushReason, IKAnalyticsClientContext } from './types';
import type { AnalyticsClock, AnalyticsTransport } from './platform';
import { buildIngestRequestV1 } from './wire-format-v1';
import { scheduleRepeating } from './timers';
import { ANALYTICS_RAW_JSON_FLUSH_THRESHOLD, ANALYTICS_URL_SAFE_LIMIT_BYTES } from './constants';

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
  /** `row` from `encodeEventRowV1`; `context` is sent once per batch, so it must not change under queued rows. */
  push: (row: Array<unknown>, context: IKAnalyticsClientContext) => void;
  flush: (reason: FlushReason) => void;
  dispose: () => void;
}

export function createBatchQueue(opts: BatchQueueOptions): BatchQueue {
  const { ingestUrl, flushIntervalMs, maxBatchSize, transport, debugLog, onInternalError, clock } = opts;
  // Without gzip, base64url expands the payload by ~4/3, so the raw-JSON ceiling must be tighter.
  const rawFlushThreshold = transport.supportsCompression
    ? ANALYTICS_RAW_JSON_FLUSH_THRESHOLD
    : Math.floor(ANALYTICS_URL_SAFE_LIMIT_BYTES / 1.37);
  const rows: Array<Array<unknown>> = [];
  // JSON length of the queued rows, separators included.
  let rowsJsonLength = 0;
  let lastContext: IKAnalyticsClientContext | null = null;
  let stopInterval: (() => void) | null = null;
  let disposed = false;

  function doFlush(reason: FlushReason) {
    if (rows.length === 0 || !lastContext) return;
    if (disposed && reason !== 'dispose' && reason !== 'pagehide' && reason !== 'visibility_hidden') return;
    const req = buildIngestRequestV1(lastContext, rows.splice(0, rows.length), reason, clock.now());
    rowsJsonLength = 0;
    transport.send(req, { ingestUrl }).then(
      (sent) =>
        debugLog(
          `beacon ${req.r}: ${req.e.length} events, ${sent.jsonBytes} B JSON → ${sent.urlBytes} B URL` +
            (sent.gzipped ? ' (gzip)' : ' (uncompressed)')
        ),
      (err) => debugLog(`beacon ${req.r} failed`, err)
    );
  }

  function projectedBatchJsonLength(context: IKAnalyticsClientContext): number {
    const envelope = JSON.stringify(buildIngestRequestV1(context, [], 'size_limit', clock.now()));
    return envelope.length + rowsJsonLength;
  }

  function push(row: Array<unknown>, context: IKAnalyticsClientContext) {
    if (disposed) return;
    lastContext = context;
    rowsJsonLength += JSON.stringify(row).length + (rows.length > 0 ? 1 : 0);
    rows.push(row);

    if (rows.length >= maxBatchSize) {
      doFlush('buffer_full');
      return;
    }

    if (projectedBatchJsonLength(context) >= rawFlushThreshold) {
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
      if (rows.length > 0) doFlush('interval');
    }),
    flushIntervalMs
  );

  return {
    push,
    flush,
    dispose,
  };
}
