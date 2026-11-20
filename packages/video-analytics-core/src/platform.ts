import type { IKAnalyticsIngestRequestV1 } from './wire-format-v1';

/** Synchronous key-value store used to persist the analytics session across page loads / app launches. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface AnalyticsClock {
  /** Wall-clock time, ms since epoch. */
  now(): number;
  /** Monotonic time in ms; only differences between readings are meaningful. */
  monotonicNow(): number;
  /**
   * Runs `fn` once after `delayMs`, on the thread that delivers player signals. Returns a cancel
   * function; calling it after `fn` ran, or twice, does nothing.
   */
  schedule(fn: () => void, delayMs: number): () => void;
}

export interface LifecycleHandlers {
  /**
   * Host moved to the background (tab hidden, app backgrounded). Ships the played time counted so
   * far and what is pending, without ending the view or stopping counting.
   */
  onHidden(): void;
  /** Host is being torn down; last chance to emit a closing event and ship it. */
  onUnload(): void;
  /**
   * Host is frozen but may resume where it left off, or be discarded without another signal
   * (web: `pagehide` with `persisted`, i.e. entering the back/forward cache). Ships what is
   * pending without ending the view.
   */
  onSuspend(): void;
}

export interface AnalyticsLifecycle {
  subscribe(handlers: LifecycleHandlers): () => void;
}

export interface SentBeacon {
  jsonBytes: number;
  urlBytes: number;
  gzipped: boolean;
}

export interface AnalyticsTransport {
  /** Whether payloads are gzipped; uncompressed payloads get a tighter batch-size ceiling. */
  readonly supportsCompression: boolean;
  /** Rejects when the request could not be sent. */
  send(request: IKAnalyticsIngestRequestV1, options: { ingestUrl: string }): Promise<SentBeacon>;
}

export type AnalyticsLogLevel = 'debug' | 'warn';

export type AnalyticsLog = (level: AnalyticsLogLevel, message: string, data?: unknown) => void;

export interface DeviceContext {
  page_url: string;
  device_display_width: number;
  device_display_height: number;
  device_display_dpr: number;
  user_agent: string;
  webdriver?: boolean;
}

export interface AnalyticsPlatform {
  clock: AnalyticsClock;
  /** Holds the session. Pass the same object to every tracker so they share one session store. */
  storage: KeyValueStorage;
  lifecycle: AnalyticsLifecycle;
  transport: AnalyticsTransport;
  log: AnalyticsLog;
  getDeviceContext(): DeviceContext;
  /**
   * Time from host start (page navigation, app launch) to tracker init, in ms.
   * When omitted or `undefined`, page load is not measured: it is sent as 0, which the dashboard
   * excludes.
   */
  getPageLoadTimeMs?(initMonotonicMs: number): number | undefined;
}
