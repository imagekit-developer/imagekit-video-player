/** Analytics ingest endpoint. */
export const ANALYTICS_INGEST_URL = 'https://edge.vexio.io/b';

export const ANALYTICS_FLUSH_INTERVAL_MS = 5000;

export const ANALYTICS_MAX_BATCH_SIZE = 50;

export const ANALYTICS_TIMEUPDATE_THROTTLE_MS = 2000;

/** If media-time advance exceeds this × wall ms since last emit, treat as seek/scrub (played_delta_ms = 0). */
export const ANALYTICS_MAX_PLAYBACK_SPEED_FACTOR = 3;

/** Conservative ceiling on final GET URL bytes. */
export const ANALYTICS_URL_SAFE_LIMIT_BYTES = 4000;

/**
 * Raw-JSON byte threshold that triggers a `size_limit` flush before another event is enqueued.
 * Sized so that after gzip + base64url expansion the final URL stays under ANALYTICS_URL_SAFE_LIMIT_BYTES.
 */
export const ANALYTICS_RAW_JSON_FLUSH_THRESHOLD = 6000;

/**
 * Session inactivity timeout. After this much wall-clock time without a meaningful
 * user signal (play / seeking / load_start), the next user action rotates session_id
 * and starts a new view marked `is_resumed_playback = true`. Industry default (Mux: 60 min).
 */
export const ANALYTICS_SESSION_INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000;

/** Hard maximum session age. Even with continuous activity the session rotates after 24 h. */
export const ANALYTICS_SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Minimum interval between localStorage activity touches. Bounds storage-write churn while
 * playing; expiry is checked at every meaningful signal so the actual rotation happens
 * close to (but never before) the inactivity window.
 */
export const ANALYTICS_SESSION_ACTIVITY_THROTTLE_MS = 10 * 60 * 1000;
