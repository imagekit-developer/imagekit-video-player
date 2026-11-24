import type { AnalyticsClock } from './platform';

/** Runs `fn` every `everyMs` until the returned function is called. */
export function scheduleRepeating(clock: AnalyticsClock, fn: () => void, everyMs: number): () => void {
  let cancelNext: () => void;
  const next = (): void => {
    cancelNext = clock.schedule(() => {
      // Scheduled first so a throwing `fn` doesn't end the loop, and so `fn` can stop it.
      next();
      fn();
    }, everyMs);
  };
  next();
  return () => cancelNext();
}
