/**
 * Batches analytics events and flushes to ingest server.
 * Supports interval flush, lifecycle flush (visibilitychange, pagehide), and sendBeacon fallback.
 */
import type { IKAnalyticsIngestRequest, IKAnalyticsEvent, IKAnalyticsClientContext } from './types';
import { buildIngestRequest } from './event-row-encoder';

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
    const req = buildIngestRequest(1, lastContext, batch, reason);
    sendToIngest(req, reason === 'visibility_hidden' || reason === 'pagehide' || reason === 'dispose');
  }

  function sendToIngest(req: IKAnalyticsIngestRequest, useBeacon: boolean) {
    if (disposed) return;
    const payload = JSON.stringify(req);
    if (debug) {
      console.log('[IK Analytics] Sending batch', req.flush_reason, req.events.length, 'events');
    }
    if (useBeacon && typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon(ingestUrl, blob);
    } else {
      fetch(ingestUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch((err) => {
        if (debug) console.warn('[IK Analytics] Flush failed', err);
      });
    }
  }

  function push(event: IKAnalyticsEvent, context: IKAnalyticsClientContext) {
    if (disposed) return;
    lastContext = context;
    events.push(event);
    if (events.length >= maxBatchSize) {
      doFlush('buffer_full');
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
    disposed = true;
    stopInterval();
    visibilityCleanup?.();
    pagehideCleanup?.();
    flush('dispose');
  }

  startInterval();
  setupLifecycleListeners();

  return {
    push,
    flush,
    dispose,
  };
}
