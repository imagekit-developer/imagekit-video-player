/**
 * Generates and manages analytics identifiers.
 * session_id persisted in localStorage; others generated per lifecycle.
 */

const SESSION_STORAGE_KEY = 'ik_analytics_session_id';
const SESSION_START_KEY = 'ik_analytics_session_start';

function randomId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function getOrCreateSessionId(): string {
  if (typeof window === 'undefined' || !window.localStorage) {
    return randomId();
  }
  try {
    let id = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!id) {
      id = randomId();
      localStorage.setItem(SESSION_STORAGE_KEY, id);
    }
    return id;
  } catch {
    return randomId();
  }
}

function getOrSetSessionStart(): number {
  if (typeof window === 'undefined' || !window.localStorage) {
    return Date.now();
  }
  try {
    const stored = localStorage.getItem(SESSION_START_KEY);
    if (stored) {
      return parseInt(stored, 10);
    }
    const now = Date.now();
    localStorage.setItem(SESSION_START_KEY, String(now));
    return now;
  } catch {
    return Date.now();
  }
}

/**
 * Format session start date as YYYY-MM-DD for ClickHouse.
 */
function formatSessionStartDate(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

export interface SessionIdentity {
  session_id: string;
  session_start_time_ms: number;
  session_start_date: string;
}

export interface PlayerIdentity {
  player_instance_id: string;
}

export interface PlaybackIdentity {
  playback_id: string;
}

/**
 * Returns current session identity. Creates session on first call.
 */
export function getOrCreateSession(): SessionIdentity {
  const session_id = getOrCreateSessionId();
  const session_start_time_ms = getOrSetSessionStart();
  const session_start_date = formatSessionStartDate(session_start_time_ms);
  return { session_id, session_start_time_ms, session_start_date };
}

/**
 * Generates a new player instance ID.
 */
export function createPlayerInstanceId(): string {
  return randomId();
}

/**
 * Generates a new playback ID (per view).
 */
export function createPlaybackId(): string {
  return randomId();
}

/**
 * Generates a unique event ID for deduplication.
 */
export function createEventId(): string {
  return randomId();
}
