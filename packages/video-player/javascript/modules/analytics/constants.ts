/**
 * Hardcoded analytics ingest / batching defaults (not configurable via IKPlayerOptions).
 */
export const ANALYTICS_INGEST_URL = 'https://stage.imagekit.io/video-analytics-ingest/analytics/ingest';
// export const ANALYTICS_INGEST_URL = 'http://localhost:8081/analytics/ingest';

export const ANALYTICS_FLUSH_INTERVAL_MS = 5000;

export const ANALYTICS_MAX_BATCH_SIZE = 50;

export const ANALYTICS_TIMEUPDATE_THROTTLE_MS = 2000;

/** If media-time advance exceeds this × wall ms since last emit, treat as seek/scrub (played_delta_ms = 0). */
export const ANALYTICS_MAX_PLAYBACK_SPEED_FACTOR = 3;
