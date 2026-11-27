#if os(iOS)
import Foundation
import ImageKitVideoAnalyticsCore
import UIKit

@MainActor
private enum SharedTransport {
    static let instance = InFlightTrackingTransport(makeURLSessionBeaconTransport())
}

@MainActor
private final class BackgroundTaskBox {
    var id: UIBackgroundTaskIdentifier = .invalid
}

/// `UIApplication` background tasks; replaced in tests, whose host has no application.
struct BackgroundTasks {
    var begin: @MainActor (_ expiration: @escaping @MainActor () -> Void) -> UIBackgroundTaskIdentifier
    var end: @MainActor (UIBackgroundTaskIdentifier) -> Void

    static var application: BackgroundTasks {
        BackgroundTasks(
            begin: { expiration in
                UIApplication.shared.beginBackgroundTask(withName: "ImageKitVideoAnalytics flush") {
                    MainActor.assumeIsolated { expiration() }
                }
            },
            end: { UIApplication.shared.endBackgroundTask($0) }
        )
    }
}

/// App lifecycle for one tracker. A backgrounded app may be killed without another signal, so
/// each flush made in the background is shipped inside a background task held until the send completes.
@MainActor
final class AppLifecycle: AnalyticsLifecycle {
    private let transport: InFlightTrackingTransport
    private let backgroundTasks: BackgroundTasks
    private var handlers: LifecycleHandlers?
    private var tokens: [NSObjectProtocol] = []

    init(transport: InFlightTrackingTransport, backgroundTasks: BackgroundTasks) {
        self.transport = transport
        self.backgroundTasks = backgroundTasks
    }

    func subscribe(_ handlers: LifecycleHandlers) -> @MainActor () -> Void {
        self.handlers = handlers
        let center = NotificationCenter.default
        tokens = [
            center.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main) {
                [weak self] _ in
                MainActor.assumeIsolated {
                    self?.isBackgrounded = true
                    self?.hidden()
                }
            },
            center.addObserver(forName: UIApplication.willEnterForegroundNotification, object: nil, queue: .main) {
                [weak self] _ in
                MainActor.assumeIsolated { self?.isBackgrounded = false }
            },
            center.addObserver(forName: UIApplication.willTerminateNotification, object: nil, queue: .main) {
                [weak self] _ in
                MainActor.assumeIsolated { self?.unload() }
            },
        ]
        return { [weak self] in self?.unsubscribe() }
    }

    private func unsubscribe() {
        tokens.forEach { NotificationCenter.default.removeObserver($0) }
        tokens = []
        handlers = nil
    }

    /// From notifications only: `UIApplication.shared` is touched only once a notification proves
    /// there is an application.
    private(set) var isBackgrounded = false

    /// While in the background, ships what is queued now instead of at the next interval.
    func flushIfBackgrounded() {
        if isBackgrounded { hidden() }
    }

    private func hidden() {
        guard let onHidden = handlers?.onHidden else { return }
        runInBackgroundTask(onHidden)
    }

    private func unload() {
        guard let onUnload = handlers?.onUnload else { return }
        runInBackgroundTask(onUnload)
    }

    func runInBackgroundTask(_ work: @MainActor () -> Void) {
        let tasks = backgroundTasks
        let box = BackgroundTaskBox()
        let end: @MainActor () -> Void = {
            guard box.id != .invalid else { return }
            tasks.end(box.id)
            box.id = .invalid
        }
        box.id = tasks.begin(end)
        work()
        transport.whenIdle(end)
    }
}

@MainActor
final class IOSPlatform: AnalyticsPlatform {
    private static let userAgent: String = {
        let info = Bundle.main.infoDictionary
        let appName = (info?["CFBundleName"] as? String) ?? (info?["CFBundleExecutable"] as? String) ?? ""
        return safariStyleUserAgent(
            isPad: UIDevice.current.userInterfaceIdiom == .pad,
            osVersion: UIDevice.current.systemVersion,
            appName: appName,
            appVersion: (info?["CFBundleShortVersionString"] as? String) ?? ""
        )
    }()

    let systemClock = SystemClock()
    let trackingTransport: InFlightTrackingTransport
    let appLifecycle: AppLifecycle

    /// `transport` replaces the URLSession beacon transport (tests).
    init(transport: (any AnalyticsTransport)? = nil, backgroundTasks: BackgroundTasks = .application) {
        trackingTransport = transport.map { InFlightTrackingTransport($0) } ?? SharedTransport.instance
        appLifecycle = AppLifecycle(transport: trackingTransport, backgroundTasks: backgroundTasks)
    }

    var clock: any AnalyticsClock {
        systemClock
    }

    var storage: any KeyValueStorage {
        InMemoryStorage.shared
    }

    var lifecycle: any AnalyticsLifecycle {
        appLifecycle
    }

    var transport: any AnalyticsTransport {
        trackingTransport
    }

    /// Sees every log call before it is written (tests).
    var logObserver: (@MainActor (AnalyticsLogLevel, String, Any?) -> Void)?

    func log(_ level: AnalyticsLogLevel, _ message: String, _ data: Any?) {
        logObserver?(level, message, data)
        writeLog(level, message, data)
    }

    func getDeviceContext() -> DeviceContext {
        let screen = UIScreen.main
        let bounds = screen.fixedCoordinateSpace.bounds
        return DeviceContext(
            pageUrl: "",
            deviceDisplayWidth: Double(bounds.width),
            deviceDisplayHeight: Double(bounds.height),
            deviceDisplayDpr: Double(screen.scale),
            userAgent: Self.userAgent
        )
    }
}
#endif
