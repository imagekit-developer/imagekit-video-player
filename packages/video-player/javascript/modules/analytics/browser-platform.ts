import {
  createBeaconTransport,
  type AnalyticsPlatform,
  type KeyValueStorage,
} from '@imagekit/video-analytics-core';

function hasLocalStorage(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage;
}

const browserStorage: KeyValueStorage = {
  getItem: (key) => (hasLocalStorage() ? localStorage.getItem(key) : null),
  setItem: (key, value) => {
    if (hasLocalStorage()) localStorage.setItem(key, value);
  },
  removeItem: (key) => {
    if (hasLocalStorage()) localStorage.removeItem(key);
  },
};

async function gzipWithCompressionStream(text: string): Promise<Uint8Array> {
  const input = new TextEncoder().encode(text);
  const stream = new Blob([input]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Shared by every player on the page so session activity writes are throttled page-wide. */
export const browserPlatform: AnalyticsPlatform = {
  clock: {
    now: () => Date.now(),
    monotonicNow: () => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
    schedule: (fn, delayMs) => {
      const id = setTimeout(fn, delayMs);
      return () => clearTimeout(id);
    },
  },
  storage: browserStorage,
  lifecycle: {
    subscribe({ onHidden, onUnload, onSuspend }) {
      if (typeof document === 'undefined' || typeof window === 'undefined') return () => {};
      const onVisibilityChange = () => {
        if (document.visibilityState === 'hidden') onHidden();
      };
      // `persisted`: the page enters the back/forward cache and may be restored with the same view.
      const onPageHide = (event: PageTransitionEvent) => (event.persisted ? onSuspend() : onUnload());
      document.addEventListener('visibilitychange', onVisibilityChange);
      window.addEventListener('pagehide', onPageHide);
      return () => {
        document.removeEventListener('visibilitychange', onVisibilityChange);
        window.removeEventListener('pagehide', onPageHide);
      };
    },
  },
  transport: createBeaconTransport({
    gzip: typeof globalThis.CompressionStream !== 'undefined' ? gzipWithCompressionStream : undefined,
    // `keepalive` only on unload flushes: routine use eats Chrome's 64 KB per-origin keepalive
    // quota and fails silently (shown as a "CORS error"). `no-cors` is safe because the
    // response is never read, and it avoids any CORS preflight.
    sendGet: (url, { keepalive }) =>
      fetch(url, { method: 'GET', keepalive, credentials: 'omit', mode: 'no-cors' }),
  }),
  log: (level, message, data) => {
    if (typeof console === 'undefined') return;
    const write = level === 'warn' ? console.warn : console.log;
    if (data === undefined) write(`[IK Analytics] ${message}`);
    else write(`[IK Analytics] ${message}`, data);
  },
  getDeviceContext: () => ({
    page_url: typeof window !== 'undefined' ? window.location.href : '',
    device_display_width: typeof screen !== 'undefined' ? screen.width : 0,
    device_display_height: typeof screen !== 'undefined' ? screen.height : 0,
    device_display_dpr: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    webdriver: typeof navigator !== 'undefined' && navigator.webdriver === true ? true : undefined,
  }),
  // performance.now() at init is ms since the navigation time origin.
  getPageLoadTimeMs: (initMonotonicMs) =>
    typeof performance !== 'undefined' ? Math.round(initMonotonicMs) : undefined,
};
