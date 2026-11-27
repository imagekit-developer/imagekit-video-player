/**
 * The analytics session, persisted in host storage.
 * Rotates on 60-min inactivity OR 24-h hard cap (whichever comes first).
 */
import {
  ANALYTICS_SESSION_INACTIVITY_TIMEOUT_MS,
  ANALYTICS_SESSION_MAX_AGE_MS,
  ANALYTICS_SESSION_ACTIVITY_THROTTLE_MS,
} from './constants';
import type { KeyValueStorage } from './platform';
import { randomId } from './ids';

const SESSION_STORAGE_KEY = 'ik_analytics_session_id';
const SESSION_START_KEY = 'ik_analytics_session_start';
const SESSION_LAST_ACTIVITY_KEY = 'ik_analytics_session_last_activity';

function formatSessionStartDate(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

export interface SessionIdentity {
  session_id: string;
  session_start_time_ms: number;
  session_start_date: string;
}

export interface SessionResolution {
  identity: SessionIdentity;
  rotated: boolean;
}

export interface SessionStore {
  /** Returns the active session, rotating on inactivity timeout or max-age cap. */
  resolve(now: number): SessionResolution;
}

const sessionStores = new WeakMap<KeyValueStorage, SessionStore>();

/** One store per storage object, so trackers sharing a storage throttle activity writes together. */
export function sessionStoreFor(storage: KeyValueStorage): SessionStore {
  let store = sessionStores.get(storage);
  if (!store) {
    store = createSessionStore(storage);
    sessionStores.set(storage, store);
  }
  return store;
}

function createSessionStore(storage: KeyValueStorage): SessionStore {
  // Storage is the source of truth across tabs/reloads; this only throttles writes.
  let lastActivityWriteMs = 0;

  function safeGet(key: string): string | null {
    try {
      return storage.getItem(key);
    } catch {
      return null;
    }
  }

  function safeSet(key: string, value: string): void {
    try {
      storage.setItem(key, value);
    } catch {
      /* storage full / blocked */
    }
  }

  function touchSessionActivity(now: number, force = false): void {
    if (!force && lastActivityWriteMs && now - lastActivityWriteMs < ANALYTICS_SESSION_ACTIVITY_THROTTLE_MS) {
      return;
    }
    safeSet(SESSION_LAST_ACTIVITY_KEY, String(now));
    lastActivityWriteMs = now;
  }

  function startSession(now: number, rotated: boolean): SessionResolution {
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
      rotated,
    };
  }

  function resolve(now: number): SessionResolution {
    const existingId = safeGet(SESSION_STORAGE_KEY);
    const existingStartRaw = safeGet(SESSION_START_KEY);
    const existingLastActivityRaw = safeGet(SESSION_LAST_ACTIVITY_KEY);

    const existingStart = existingStartRaw ? parseInt(existingStartRaw, 10) : NaN;
    const existingLastActivity = existingLastActivityRaw ? parseInt(existingLastActivityRaw, 10) : NaN;

    const hasValidSession = !!existingId && Number.isFinite(existingStart);
    const ageExceeded = hasValidSession && now - existingStart > ANALYTICS_SESSION_MAX_AGE_MS;

    if (hasValidSession && !ageExceeded) {
      const hasActivity = Number.isFinite(existingLastActivity);
      if (!hasActivity || now - existingLastActivity <= ANALYTICS_SESSION_INACTIVITY_TIMEOUT_MS) {
        // A session without an activity record (legacy client) is seeded rather than rotated.
        touchSessionActivity(now, !hasActivity);
        return {
          identity: {
            session_id: existingId as string,
            session_start_time_ms: existingStart,
            session_start_date: formatSessionStartDate(existingStart),
          },
          rotated: false,
        };
      }
    }

    return startSession(now, hasValidSession);
  }

  return { resolve };
}
