// The analytics session, persisted in host storage.
// Rotates on 60-min inactivity OR 24-h hard cap (whichever comes first).
import Foundation

private let sessionStorageKey = "ik_analytics_session_id"
private let sessionStartKey = "ik_analytics_session_start"
private let sessionLastActivityKey = "ik_analytics_session_last_activity"

/// `new Date(ts).toISOString().slice(0, 10)`.
func formatSessionStartDate(_ ts: Double) -> String {
    String(isoString(ts).prefix(10))
}

/// `new Date(ts).toISOString()`: UTC, milliseconds, `Z`.
package func isoString(_ ts: Double) -> String {
    let ms = Int64(ts.rounded(.towardZero))
    var seconds = time_t(ms >= 0 ? ms / 1000 : (ms - 999) / 1000)
    let millis = ms - Int64(seconds) * 1000
    var parts = tm()
    gmtime_r(&seconds, &parts)
    return String(
        format: "%04d-%02d-%02dT%02d:%02d:%02d.%03dZ",
        Int(parts.tm_year) + 1900, Int(parts.tm_mon) + 1, Int(parts.tm_mday),
        Int(parts.tm_hour), Int(parts.tm_min), Int(parts.tm_sec), Int(millis)
    )
}

/// `parseInt(s, 10)`: leading whitespace, an optional sign, then digits up to the first non-digit.
func parseIntBase10(_ s: String) -> Double? {
    var rest = Substring(s).drop { $0.isWhitespace }
    var sign: Double = 1
    if let first = rest.first, first == "-" || first == "+" {
        if first == "-" { sign = -1 }
        rest = rest.dropFirst()
    }
    let digits = rest.prefix { $0.isASCII && $0.isNumber }
    guard !digits.isEmpty, let value = Double(digits) else { return nil }
    return sign * value
}

package struct SessionIdentity: Sendable {
    package var sessionId: String
    package var sessionStartTimeMs: Double
    package var sessionStartDate: String
}

package struct SessionResolution: Sendable {
    package var identity: SessionIdentity
    package var rotated: Bool
}

@MainActor
private final class SessionStoreEntry {
    weak var storage: (any KeyValueStorage)?
    let store: SessionStore

    init(storage: any KeyValueStorage, store: SessionStore) {
        self.storage = storage
        self.store = store
    }
}

@MainActor
private var sessionStores: [ObjectIdentifier: SessionStoreEntry] = [:]

/// One store per storage object, so trackers sharing a storage throttle activity writes together.
@MainActor
package func sessionStoreFor(_ storage: any KeyValueStorage) -> SessionStore {
    sessionStores = sessionStores.filter { $0.value.storage != nil }
    if let entry = sessionStores[ObjectIdentifier(storage)], entry.storage === storage {
        return entry.store
    }
    let store = SessionStore(storage: storage)
    sessionStores[ObjectIdentifier(storage)] = SessionStoreEntry(storage: storage, store: store)
    return store
}

@MainActor
package final class SessionStore {
    // Weak so the registry (a `WeakMap` in TS) does not keep the storage alive.
    private weak var storage: (any KeyValueStorage)?
    // Storage is the source of truth across launches; this only throttles writes.
    private var lastActivityWriteMs: Double = 0

    fileprivate init(storage: any KeyValueStorage) {
        self.storage = storage
    }

    private func safeGet(_ key: String) -> String? {
        storage?.getItem(key)
    }

    private func safeSet(_ key: String, _ value: String) {
        storage?.setItem(key, value)
    }

    private func touchSessionActivity(_ now: Double, force: Bool = false) {
        if !force && lastActivityWriteMs != 0 && now - lastActivityWriteMs < analyticsSessionActivityThrottleMs {
            return
        }
        safeSet(sessionLastActivityKey, jsNumberString(now))
        lastActivityWriteMs = now
    }

    private func startSession(_ now: Double, _ rotated: Bool) -> SessionResolution {
        let newId = randomId()
        safeSet(sessionStorageKey, newId)
        safeSet(sessionStartKey, jsNumberString(now))
        safeSet(sessionLastActivityKey, jsNumberString(now))
        lastActivityWriteMs = now
        return SessionResolution(
            identity: SessionIdentity(
                sessionId: newId,
                sessionStartTimeMs: now,
                sessionStartDate: formatSessionStartDate(now)
            ),
            rotated: rotated
        )
    }

    /// Returns the active session, rotating on inactivity timeout or max-age cap.
    package func resolve(_ now: Double) -> SessionResolution {
        let existingId = safeGet(sessionStorageKey)
        let existingStartRaw = safeGet(sessionStartKey)
        let existingLastActivityRaw = safeGet(sessionLastActivityKey)

        let existingStart = existingStartRaw.flatMap(parseIntBase10)
        let existingLastActivity = existingLastActivityRaw.flatMap(parseIntBase10)

        let hasValidSession = existingId?.isEmpty == false && existingStart != nil
        let ageExceeded = hasValidSession && now - existingStart! > analyticsSessionMaxAgeMs

        if hasValidSession && !ageExceeded, let existingId, let existingStart {
            let hasActivity = existingLastActivity != nil
            if !hasActivity || now - existingLastActivity! <= analyticsSessionInactivityTimeoutMs {
                // A session without an activity record (legacy client) is seeded rather than rotated.
                touchSessionActivity(now, force: !hasActivity)
                return SessionResolution(
                    identity: SessionIdentity(
                        sessionId: existingId,
                        sessionStartTimeMs: existingStart,
                        sessionStartDate: formatSessionStartDate(existingStart)
                    ),
                    rotated: false
                )
            }
        }

        return startSession(now, hasValidSession)
    }
}
