import Foundation
import ImageKitVideoAnalyticsCore
#if os(iOS)
import AVFoundation
import AVKit
import ObjectiveC
import UIKit
#endif

/// ImageKit video analytics for `AVPlayer`.
///
/// ```swift
/// let monitor = ImageKitVideoAnalytics.monitor(playerViewController: controller, imagekitId: "your_imagekit_id")
/// ```
public enum ImageKitVideoAnalytics {
    /// This SDK's version, reported as `imagekit_plugin_version`.
    public static let version = "0.1.0"

    static let integrationName = "imagekit-video-analytics-ios"

    /// An error as reported to analytics.
    public struct ErrorInfo: Sendable {
        /// `domain:code` for player errors, e.g. `NSURLErrorDomain:-1100`.
        public var code: String
        public var message: String?
        /// JSON with the reporting signal (`source`), `http_status`, failing `url` and `playhead_ms` when known.
        public var context: String?

        public init(code: String, message: String? = nil, context: String? = nil) {
            self.code = code
            self.message = message
            self.context = context
        }
    }

    /// Replacement values from `Config.mapError`; `nil` fields keep the original value.
    public struct MappedError: Sendable {
        public var code: String?
        public var message: String?
        public var context: String?

        public init(code: String? = nil, message: String? = nil, context: String? = nil) {
            self.code = code
            self.message = message
            self.context = context
        }
    }

    public struct Config {
        public var userId: String?
        /// Keys `cd_1`, `cd_2`, …; each slot must be registered in the ImageKit dashboard. Values over
        /// 256 bytes are dropped by the server.
        public var customDimensions: [String: String]?
        /// Rewrites an error before it is reported; return `nil` to keep it.
        public var mapError: (@MainActor (ErrorInfo) throws -> MappedError?)?
        /// Logs every event and beacon (os_log, subsystem `io.imagekit.video-analytics`).
        public var debug: Bool

        public init(
            userId: String? = nil,
            customDimensions: [String: String]? = nil,
            mapError: (@MainActor (ErrorInfo) throws -> MappedError?)? = nil,
            debug: Bool = false
        ) {
            self.userId = userId
            self.customDimensions = customDimensions
            self.mapError = mapError
            self.debug = debug
        }

        var trackerConfig: AnalyticsTrackerUserConfig {
            var coreMapError: (@MainActor (AnalyticsErrorInfo) throws -> MappedAnalyticsError?)?
            if let mapError {
                coreMapError = { info in
                    let mapped = try mapError(ErrorInfo(code: info.code, message: info.message, context: info.context))
                    return mapped.map { MappedAnalyticsError(code: $0.code, message: $0.message, context: $0.context) }
                }
            }
            return AnalyticsTrackerUserConfig(
                userId: userId,
                customDimensions: customDimensions,
                mapError: coreMapError,
                debug: debug
            )
        }
    }
}

#if os(iOS)
nonisolated(unsafe) private var monitorAssociationKey: UInt8 = 0

/// Attached to the `AVPlayer`, so tracking lasts as long as the player even if the app drops the
/// monitor, and ends when the player is released.
private final class MonitorRetainer: Sendable {
    let monitor: ImageKitVideoAnalytics.Monitor

    init(_ monitor: ImageKitVideoAnalytics.Monitor) {
        self.monitor = monitor
    }

    deinit {
        let monitor = monitor
        onMain { monitor.dispose() }
    }
}

extension ImageKitVideoAnalytics {
    /// Tracks the player of `playerViewController`; player size and scale come from its video bounds.
    @MainActor
    public static func monitor(
        playerViewController: AVPlayerViewController,
        imagekitId: String,
        config: Config = Config()
    ) -> Monitor {
        monitor(
            player: playerViewController.player,
            surface: .viewController(playerViewController),
            imagekitId: imagekitId,
            config: config,
            platform: IOSPlatform()
        )
    }

    /// Tracks the player of `playerLayer`; player size and scale come from the layer.
    @MainActor
    public static func monitor(playerLayer: AVPlayerLayer, imagekitId: String, config: Config = Config()) -> Monitor {
        monitor(
            player: playerLayer.player,
            surface: .layer(playerLayer),
            imagekitId: imagekitId,
            config: config,
            platform: IOSPlatform()
        )
    }

    /// Tracks a player drawn by a custom view. `playerSize` is the size it is shown at, in points;
    /// update it with `Monitor.setPlayerSize(_:)`.
    @MainActor
    public static func monitor(
        player: AVPlayer,
        playerSize: CGSize,
        imagekitId: String,
        config: Config = Config()
    ) -> Monitor {
        monitor(player: player, surface: .size(playerSize), imagekitId: imagekitId, config: config, platform: IOSPlatform())
    }

    @MainActor
    static func monitor(
        player: AVPlayer?,
        surface: PlayerSurface,
        imagekitId: String,
        config: Config,
        platform: IOSPlatform
    ) -> Monitor {
        guard let player else {
            writeLog(.warn, "analytics disabled: no AVPlayer to monitor", nil)
            return Monitor()
        }
        (objc_getAssociatedObject(player, &monitorAssociationKey) as? MonitorRetainer)?.monitor.dispose()

        let clock = platform.systemClock
        let adapter = AVPlayerAdapter(player: player, surface: surface, monotonicNow: { clock.monotonicNow() })
        // `playerready` is sent at monitor(): player startup is reported as 0 (not measured).
        clock.pinnedMonotonicMs = clock.monotonicNow()
        let tracker = createAnalyticsTracker(AnalyticsTrackerOptions(
            config: config.trackerConfig,
            imagekitId: imagekitId,
            player: adapter,
            platform: platform,
            integration: AnalyticsIntegration(name: integrationName, version: version)
        ))
        adapter.emitPlayerReady()
        clock.pinnedMonotonicMs = nil

        let lifecycle = platform.appLifecycle
        adapter.onPlaybackStopped = { [weak lifecycle] in lifecycle?.flushIfBackgrounded() }
        adapter.start()

        let monitor = Monitor(player: player, adapter: adapter, tracker: tracker, platform: platform)
        objc_setAssociatedObject(player, &monitorAssociationKey, MonitorRetainer(monitor), .OBJC_ASSOCIATION_RETAIN_NONATOMIC)
        return monitor
    }

    /// Controls one monitored player. The player keeps it alive until `dispose()` or until the
    /// player is released, so the app does not need to store it.
    @MainActor
    public final class Monitor {
        private weak var player: AVPlayer?
        private let adapter: AVPlayerAdapter?
        private let tracker: (any AnalyticsTrackerHandle)?
        private let platform: IOSPlatform?
        private var disposed = false

        init() {
            adapter = nil
            tracker = nil
            platform = nil
            disposed = true
        }

        init(player: AVPlayer, adapter: AVPlayerAdapter, tracker: any AnalyticsTrackerHandle, platform: IOSPlatform) {
            self.player = player
            self.adapter = adapter
            self.tracker = tracker
            self.platform = platform
        }

        /// Replaces all custom dimensions; events already recorded keep the previous values.
        public func setCustomDimensions(_ dimensions: [String: String]) {
            tracker?.setCustomDimensions(dimensions)
        }

        public func getCustomDimensions() -> [String: String] {
            tracker?.getCustomDimensions() ?? [:]
        }

        /// Reports an error without ending the view (a fatal player error ends it). Goes through `mapError`.
        public func reportError(_ error: ErrorInfo) {
            tracker?.reportError(AnalyticsErrorInfo(code: error.code, message: error.message, context: error.context))
        }

        /// The size the player is shown at, in points, for a monitor created with `playerSize`.
        public func setPlayerSize(_ size: CGSize) {
            adapter?.setPlayerSize(size)
        }

        /// Ends the view, ships what is pending and stops observing the player.
        public func dispose() {
            if disposed { return }
            disposed = true
            if let player,
               let retainer = objc_getAssociatedObject(player, &monitorAssociationKey) as? MonitorRetainer,
               retainer.monitor === self {
                objc_setAssociatedObject(player, &monitorAssociationKey, nil, .OBJC_ASSOCIATION_RETAIN_NONATOMIC)
            }
            guard let tracker, let platform else { return }
            if platform.appLifecycle.isBackgrounded {
                platform.appLifecycle.runInBackgroundTask { tracker.dispose() }
            } else {
                tracker.dispose()
            }
        }
    }
}
#endif
