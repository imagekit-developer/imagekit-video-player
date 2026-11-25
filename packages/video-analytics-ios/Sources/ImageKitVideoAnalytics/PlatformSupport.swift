import Foundation
import ImageKitVideoAnalyticsCore
import os

@MainActor
final class SystemClock: AnalyticsClock {
    /// While set, `monotonicNow()` returns it, so readings taken together are equal.
    var pinnedMonotonicMs: Double?

    func now() -> Double {
        (Date().timeIntervalSince1970 * 1000).rounded(.down)
    }

    func monotonicNow() -> Double {
        pinnedMonotonicMs ?? Self.monotonicMs()
    }

    nonisolated static func monotonicMs() -> Double {
        Double(clock_gettime_nsec_np(CLOCK_MONOTONIC_RAW)) / 1_000_000
    }

    func schedule(_ fn: @escaping @MainActor () -> Void, delayMs: Double) -> @MainActor () -> Void {
        let item = DispatchWorkItem {
            MainActor.assumeIsolated { fn() }
        }
        let delayUs = Int((Swift.max(0, delayMs) * 1000).rounded())
        DispatchQueue.main.asyncAfter(deadline: .now() + .microseconds(delayUs), execute: item)
        return { item.cancel() }
    }
}

/// Sessions live in memory (DECISIONS pending item 11); one store shared by every tracker.
@MainActor
final class InMemoryStorage: KeyValueStorage {
    static let shared = InMemoryStorage()

    private var items: [String: String] = [:]

    func getItem(_ key: String) -> String? {
        items[key]
    }

    func setItem(_ key: String, _ value: String) {
        items[key] = value
    }

    func removeItem(_ key: String) {
        items[key] = nil
    }
}

private let logger = Logger(subsystem: "io.imagekit.video-analytics", category: "analytics")

func writeLog(_ level: AnalyticsLogLevel, _ message: String, _ data: Any?) {
    let text = data.map { "[IK Analytics] \(message) \(String(describing: $0))" } ?? "[IK Analytics] \(message)"
    switch level {
    case .debug:
        logger.notice("\(text, privacy: .public)")
    case .warn:
        logger.warning("\(text, privacy: .public)")
    }
}

/// Keeps what a User-Agent product token allows, so the app name cannot break the UA's structure.
private func productToken(_ value: String, fallback: String) -> String {
    let allowed = Set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._")
    let token = String(value.filter { allowed.contains($0) })
    return token.isEmpty ? fallback : token
}

/// Safari's format, so ingest parses OS, version and device as for Mobile Safari; the app takes the
/// place of `Version/x Mobile/y Safari/z`.
func safariStyleUserAgent(isPad: Bool, osVersion: String, appName: String, appVersion: String) -> String {
    let os = osVersion.replacingOccurrences(of: ".", with: "_")
    let device = isPad ? "iPad; CPU OS \(os) like Mac OS X" : "iPhone; CPU iPhone OS \(os) like Mac OS X"
    let app = "\(productToken(appName, fallback: "App"))/\(productToken(appVersion, fallback: "0"))"
    return "Mozilla/5.0 (\(device)) AppleWebKit/605.1.15 (KHTML, like Gecko) \(app)"
}

/// Runs `body` on the main actor: at once when already on the main thread, else queued to it.
func onMain(_ body: @escaping @MainActor @Sendable () -> Void) {
    if Thread.isMainThread {
        MainActor.assumeIsolated { body() }
    } else {
        DispatchQueue.main.async { body() }
    }
}
