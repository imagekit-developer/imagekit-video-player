/**
 * Generates and manages analytics identifiers.
 * session_id persisted in localStorage; others generated per lifecycle.
 *
 * Session rotates on 60-min inactivity OR 24-h hard cap (whichever comes first).
 */
import {
  ANALYTICS_SESSION_INACTIVITY_TIMEOUT_MS,
  ANALYTICS_SESSION_MAX_AGE_MS,
  ANALYTICS_SESSION_ACTIVITY_THROTTLE_MS,
} from './constants';

const SESSION_STORAGE_KEY = 'ik_analytics_session_id';
const SESSION_START_KEY = 'ik_analytics_session_start';
const SESSION_LAST_ACTIVITY_KEY = 'ik_analytics_session_last_activity';

function randomId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function safeGet(key: string): string | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage full / blocked */
  }
}

function safeRemove(key: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

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
 * Last in-memory activity ms; used to throttle localStorage writes.
 * The localStorage value is the source of truth across tabs/reloads.
 */
let lastActivityWriteMs = 0;

/**
 * Returns the active session, rotating on inactivity timeout or max-age cap.
 * Caller passes `now` for testability.
 */
export function resolveSession(now: number = Date.now()): {
  identity: SessionIdentity;
  rotated: boolean;
} {
  const existingId = safeGet(SESSION_STORAGE_KEY);
  const existingStartRaw = safeGet(SESSION_START_KEY);
  const existingLastActivityRaw = safeGet(SESSION_LAST_ACTIVITY_KEY);

  const existingStart = existingStartRaw ? parseInt(existingStartRaw, 10) : NaN;
  const existingLastActivity = existingLastActivityRaw
    ? parseInt(existingLastActivityRaw, 10)
    : NaN;

  const hasValidSession = !!existingId && Number.isFinite(existingStart);
  const ageExceeded =
    hasValidSession && now - existingStart > ANALYTICS_SESSION_MAX_AGE_MS;

  // Active session within both inactivity window and max-age cap — reuse.
  if (
    hasValidSession &&
    Number.isFinite(existingLastActivity) &&
    now - existingLastActivity <= ANALYTICS_SESSION_INACTIVITY_TIMEOUT_MS &&
    !ageExceeded
  ) {
    touchSessionActivity(now);
    return {
      identity: {
        session_id: existingId as string,
        session_start_time_ms: existingStart,
        session_start_date: formatSessionStartDate(existingStart),
      },
      rotated: false,
    };
  }

  // No activity record yet (legacy client) and not over max-age — seed activity.
  if (hasValidSession && !Number.isFinite(existingLastActivity) && !ageExceeded) {
    touchSessionActivity(now, /* force */ true);
    return {
      identity: {
        session_id: existingId as string,
        session_start_time_ms: existingStart,
        session_start_date: formatSessionStartDate(existingStart),
      },
      rotated: false,
    };
  }

  // No session yet — create one. NOT a rotation.
  if (!hasValidSession) {
    const newId = randomId();
    safeSet(SESSION_STORAGE_KEY, newId);
    safeSet(SESSION_START_KEY, String(now));
    safeSet(SESSION_LAST_ACTIVITY_KEY, String(now));
    lastActivityWriteMs = now;
    return {
      identity: {
        session_id: newId,
        session_start_time_ms: now,
        session_start_date: formatSessionStartDate(now),
      },
      rotated: false,
    };
  }

  // Inactivity exceeded OR max-age cap reached → rotate.
  const newId = randomId();
  safeSet(SESSION_STORAGE_KEY, newId);
  safeSet(SESSION_START_KEY, String(now));
  safeSet(SESSION_LAST_ACTIVITY_KEY, String(now));
  lastActivityWriteMs = now;
  return {
    identity: {
      session_id: newId,
      session_start_time_ms: now,
      session_start_date: formatSessionStartDate(now),
    },
    rotated: true,
  };
}

/**
 * Records meaningful user activity. Writes to localStorage are throttled by
 * `ANALYTICS_SESSION_ACTIVITY_THROTTLE_MS` to bound storage churn during playback.
 *
 * `force = true` bypasses the throttle (used internally on first-touch / rotation).
 */
export function touchSessionActivity(now: number = Date.now(), force = false): void {
  if (!force && lastActivityWriteMs && now - lastActivityWriteMs < ANALYTICS_SESSION_ACTIVITY_THROTTLE_MS) {
    return;
  }
  safeSet(SESSION_LAST_ACTIVITY_KEY, String(now));
  lastActivityWriteMs = now;
}

/**
 * Returns current session identity, creating one if missing. Does not signal rotation.
 * Use `resolveSession` for the active (rotation-aware) path.
 *
 * Kept for backward compatibility with callers that just need the current id at init.
 */
export function getOrCreateSession(): SessionIdentity {
  return resolveSession(Date.now()).identity;
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

/**
 * Test-only helper: clear all persisted session state. Not exported from the package barrel.
 */
export function _resetSessionForTests(): void {
  safeRemove(SESSION_STORAGE_KEY);
  safeRemove(SESSION_START_KEY);
  safeRemove(SESSION_LAST_ACTIVITY_KEY);
  lastActivityWriteMs = 0;
}
