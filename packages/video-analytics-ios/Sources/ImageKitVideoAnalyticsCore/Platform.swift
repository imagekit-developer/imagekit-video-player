/// Synchronous key-value store used to persist the analytics session across launches.
@MainActor
package protocol KeyValueStorage: AnyObject {
    func getItem(_ key: String) -> String?
    func setItem(_ key: String, _ value: String)
    func removeItem(_ key: String)
}

@MainActor
package protocol AnalyticsClock: AnyObject {
    /// Wall-clock time, whole ms since epoch (as `Date.now()`).
    func now() -> Double
    /// Monotonic time in ms; only differences between readings are meaningful.
    func monotonicNow() -> Double
    /// Runs `fn` once after `delayMs`, on the main actor. Returns a cancel function; calling it after
    /// `fn` ran, or twice, does nothing.
    func schedule(_ fn: @escaping @MainActor () -> Void, delayMs: Double) -> @MainActor () -> Void
}

package struct LifecycleHandlers {
    /// Host moved to the background (app backgrounded). Ships the played time counted so far and
    /// what is pending, without ending the view or stopping counting.
    package var onHidden: @MainActor () -> Void
    /// Host is being torn down; last chance to emit a closing event and ship it.
    package var onUnload: @MainActor () -> Void
    /// Host is frozen but may resume where it left off, or be discarded without another signal.
    /// Ships what is pending without ending the view.
    package var onSuspend: @MainActor () -> Void

    package init(
        onHidden: @escaping @MainActor () -> Void,
        onUnload: @escaping @MainActor () -> Void,
        onSuspend: @escaping @MainActor () -> Void
    ) {
        self.onHidden = onHidden
        self.onUnload = onUnload
        self.onSuspend = onSuspend
    }
}

@MainActor
package protocol AnalyticsLifecycle: AnyObject {
    func subscribe(_ handlers: LifecycleHandlers) -> @MainActor () -> Void
}

package struct SentBeacon: Sendable {
    package var jsonBytes: Int
    package var urlBytes: Int
    package var gzipped: Bool

    package init(jsonBytes: Int, urlBytes: Int, gzipped: Bool) {
        self.jsonBytes = jsonBytes
        self.urlBytes = urlBytes
        self.gzipped = gzipped
    }
}

package struct AnalyticsSendOptions: Sendable {
    package var ingestUrl: String

    package init(ingestUrl: String) {
        self.ingestUrl = ingestUrl
    }
}

@MainActor
package protocol AnalyticsTransport: AnyObject {
    /// Whether payloads are gzipped; uncompressed payloads get a tighter batch-size ceiling.
    var supportsCompression: Bool { get }
    /// Completes with a failure when the request could not be sent.
    func send(
        _ request: IKAnalyticsIngestRequestV1,
        options: AnalyticsSendOptions,
        completion: @escaping @MainActor (Result<SentBeacon, any Error>) -> Void
    )
}

package enum AnalyticsLogLevel: String, Sendable {
    case debug
    case warn
}

package struct DeviceContext: Sendable {
    package var pageUrl: String
    package var deviceDisplayWidth: Double
    package var deviceDisplayHeight: Double
    package var deviceDisplayDpr: Double
    package var userAgent: String
    package var webdriver: Bool?

    package init(
        pageUrl: String,
        deviceDisplayWidth: Double,
        deviceDisplayHeight: Double,
        deviceDisplayDpr: Double,
        userAgent: String,
        webdriver: Bool? = nil
    ) {
        self.pageUrl = pageUrl
        self.deviceDisplayWidth = deviceDisplayWidth
        self.deviceDisplayHeight = deviceDisplayHeight
        self.deviceDisplayDpr = deviceDisplayDpr
        self.userAgent = userAgent
        self.webdriver = webdriver
    }
}

@MainActor
package protocol AnalyticsPlatform: AnyObject {
    var clock: any AnalyticsClock { get }
    /// Holds the session. Pass the same object to every tracker so they share one session store.
    var storage: any KeyValueStorage { get }
    var lifecycle: any AnalyticsLifecycle { get }
    var transport: any AnalyticsTransport { get }
    func log(_ level: AnalyticsLogLevel, _ message: String, _ data: Any?)
    func getDeviceContext() -> DeviceContext
    /// Time from host start (app launch) to tracker init, in ms.
    /// When `nil` (the default), page load is not measured: it is sent as 0, which the dashboard excludes.
    func getPageLoadTimeMs(_ initMonotonicMs: Double) -> Double?
}

extension AnalyticsPlatform {
    package func getPageLoadTimeMs(_ initMonotonicMs: Double) -> Double? {
        nil
    }
}
