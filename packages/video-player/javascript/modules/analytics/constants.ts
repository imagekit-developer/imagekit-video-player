/** Analytics ingest endpoint. */
export const ANALYTICS_INGEST_URL = 'https://stage-ikedge.imagekit.io/b';

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
