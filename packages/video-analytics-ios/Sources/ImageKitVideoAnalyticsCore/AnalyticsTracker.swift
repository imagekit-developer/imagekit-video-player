// Orchestrates analytics state machine, encoder, and batch queue.
// Receives signals from the player binding, drives the state machine, and flushes events to ingest.

/// All fields optional; omitted fields keep their original value.
package struct MappedAnalyticsError: Sendable {
    package var code: String?
    package var message: String?
    package var context: String?

    package init(code: String? = nil, message: String? = nil, context: String? = nil) {
        self.code = code
        self.message = message
        self.context = context
    }
}

package struct AnalyticsTrackerUserConfig {
    package var userId: String?
    package var customDimensions: [String: String]?
    package var mapError: (@MainActor (AnalyticsErrorInfo) throws -> MappedAnalyticsError?)?
    /// Logs every event and beacon.
    package var debug: Bool

    package init(
        userId: String? = nil,
        customDimensions: [String: String]? = nil,
        mapError: (@MainActor (AnalyticsErrorInfo) throws -> MappedAnalyticsError?)? = nil,
        debug: Bool = false
    ) {
        self.userId = userId
        self.customDimensions = customDimensions
        self.mapError = mapError
        self.debug = debug
    }
}

/// The ImageKit SDK embedding the tracker, reported as `imagekit_plugin`.
package struct AnalyticsIntegration: Sendable {
    package var name: String
    package var version: String

    package init(name: String, version: String) {
        self.name = name
        self.version = version
    }
}

package struct AnalyticsTrackerOptions {
    package var config: AnalyticsTrackerUserConfig
    package var imagekitId: String
    package var player: any AnalyticsPlayer
    package var platform: any AnalyticsPlatform
    package var integration: AnalyticsIntegration
    /// Monotonic time at which the integration started initializing; defaults to now.
    package var initMonotonicMs: Double?

    package init(
        config: AnalyticsTrackerUserConfig,
        imagekitId: String,
        player: any AnalyticsPlayer,
        platform: any AnalyticsPlatform,
        integration: AnalyticsIntegration,
        initMonotonicMs: Double? = nil
    ) {
        self.config = config
        self.imagekitId = imagekitId
        self.player = player
        self.platform = platform
        self.integration = integration
        self.initMonotonicMs = initMonotonicMs
    }
}

@MainActor
package protocol AnalyticsTrackerHandle: AnyObject {
    /// Manually report an error into the analytics pipeline without changing
    /// player state. Goes through `mapError` like a native player error.
    func reportError(_ error: AnalyticsErrorInfo)
    /// Replaces all custom dimensions; events already recorded keep the previous values.
    func setCustomDimensions(_ dims: [String: String])
    func getCustomDimensions() -> [String: String]
    /// Flushes pending events and stops listening to the player and host.
    func dispose()
}

/// `^cd_\d+$` (ASCII digits, as JS `\d`).
private func isCustomDimensionSlot(_ slot: String) -> Bool {
    guard slot.hasPrefix("cd_") else { return false }
    let digits = slot.utf8.dropFirst(3)
    return !digits.isEmpty && digits.allSatisfy { $0 >= UInt8(ascii: "0") && $0 <= UInt8(ascii: "9") }
}

/// Slots are visited in key order (a JS object keeps insertion order, a Swift dictionary has none).
private func sanitizeCustomDimensions(
    _ dims: [String: String]?,
    _ warn: (String) -> Void
) -> [String: String]? {
    guard let dims else { return nil }
    var out: [String: String] = [:]
    var count = 0
    for slot in dims.keys.sorted() {
        let value = dims[slot]!
        if !isCustomDimensionSlot(slot) {
            warn("custom dimension \"\(slot)\" dropped: key must look like cd_1")
            continue
        }
        if value.isEmpty {
            warn("custom dimension \"\(slot)\" dropped: value is empty")
            continue
        }
        out[slot] = value
        count += 1
    }
    return count > 0 ? out : nil
}

private func secondsToMs(_ seconds: Double?) -> Double? {
    guard let seconds, seconds.isFinite else { return nil }
    return jsRound(seconds * 1000)
}

/// Never throws: if the tracker cannot start, analytics is disabled and the player is unaffected.
@MainActor
package func createAnalyticsTracker(_ options: AnalyticsTrackerOptions) -> any AnalyticsTrackerHandle {
    do {
        return try AnalyticsTracker(options)
    } catch {
        options.platform.log(.warn, "analytics disabled: tracker failed to start", error)
        return DisabledAnalyticsTracker()
    }
}

@MainActor
private final class DisabledAnalyticsTracker: AnalyticsTrackerHandle {
    func reportError(_ error: AnalyticsErrorInfo) {}
    func setCustomDimensions(_ dims: [String: String]) {}
    func getCustomDimensions() -> [String: String] { [:] }
    func dispose() {}
}

private struct PendingRotation {
    var sessionId: String
    var sessionStartDate: String
    var sessionStartTimeIso: String
}

private enum ErrorKind {
    case native
    case report
}

@MainActor
private final class AnalyticsTracker: AnalyticsTrackerHandle {
    private let userConfig: AnalyticsTrackerUserConfig
    private let player: any AnalyticsPlayer
    private let platform: any AnalyticsPlatform
    private let clock: any AnalyticsClock
    private let initMonotonicMs: Double
    private let sessionStore: SessionStore
    // Holds the new session identity during a rotation. Applied only once the state machine has
    // emitted the OLD view's closing viewend (via the onSessionInit callback), so that viewend
    // keeps the old session_id.
    private var pendingRotation: PendingRotation?
    // The open view's URL, from its load_start. Every row of the view carries it.
    private var viewSourceUrl: String?
    private var viewSourceKey: String?
    private var playedTime = PlayedTimeCounter(maxEstimateMs: analyticsMaxTimeupdateGapMs)
    private var stopTicks: (@MainActor () -> Void)?
    private var lastReportMonotonic: Double
    private var resumeCountingAfterSeek = false
    private let context: IKAnalyticsClientContext
    private let batchQueue: BatchQueue
    private var stateMachine: AnalyticsStateMachine!
    // The bitrate last read; at a rendition switch it is still the old rendition's.
    private var windowBitrate: Double?
    private var unsubscribeLifecycle: (@MainActor () -> Void)?
    private var unsubscribe: (@MainActor () -> Void)?

    init(_ options: AnalyticsTrackerOptions) throws {
        let platform = options.platform
        let clock = platform.clock
        userConfig = options.config
        player = options.player
        self.platform = platform
        self.clock = clock
        initMonotonicMs = options.initMonotonicMs ?? clock.monotonicNow()

        // First touch on a fresh host start is never a rotation; it seeds the tracker context.
        sessionStore = sessionStoreFor(platform.storage)
        let session = sessionStore.resolve(clock.now()).identity
        let playerInstanceId = createPlayerInstanceId()
        lastReportMonotonic = clock.monotonicNow()

        let device = platform.getDeviceContext()
        context = IKAnalyticsClientContext(
            imagekitId: options.imagekitId,
            sessionId: session.sessionId,
            playerInstanceId: playerInstanceId,
            userId: userConfig.userId,
            pageUrl: device.pageUrl,
            deviceDisplayWidth: device.deviceDisplayWidth,
            deviceDisplayHeight: device.deviceDisplayHeight,
            deviceDisplayDpr: device.deviceDisplayDpr,
            userAgent: device.userAgent,
            sessionStartDate: session.sessionStartDate,
            sessionStartTimeIso: isoString(session.sessionStartTimeMs),
            playerSoftware: player.software,
            playerSoftwareVersion: player.softwareVersion,
            imagekitPlugin: options.integration.name,
            imagekitPluginVersion: options.integration.version,
            customDimensions: sanitizeCustomDimensions(userConfig.customDimensions) { platform.log(.warn, $0, nil) },
            webdriver: device.webdriver == true ? true : nil
        )

        let debugEnabled = userConfig.debug
        batchQueue = BatchQueue(BatchQueueOptions(
            ingestUrl: analyticsIngestUrl,
            flushIntervalMs: analyticsFlushIntervalMs,
            maxBatchSize: analyticsMaxBatchSize,
            transport: platform.transport,
            debugLog: { message, data in if debugEnabled { platform.log(.debug, message, data) } },
            clock: clock
        ))

        stateMachine = AnalyticsStateMachine(
            AnalyticsStateMachineCallbacks(
                onSessionInit: { [unowned self] in
                    // On a rotation, flip to the new session here — after the old view's
                    // viewend(sessionrotate) has been emitted, before sessioninit.
                    if let pendingRotation = self.pendingRotation {
                        // Context travels per batch: ship the old view's queued viewend under the old session.
                        self.batchQueue.flush(.manual)
                        self.context.sessionId = pendingRotation.sessionId
                        self.context.sessionStartDate = pendingRotation.sessionStartDate
                        self.context.sessionStartTimeIso = pendingRotation.sessionStartTimeIso
                        self.pendingRotation = nil
                    }
                },
                onEvent: { [unowned self] event in try self.pushEvent(event) }
            ),
            AnalyticsStateMachineIds(eventId: createEventId, playbackId: createPlaybackId),
            { clock.monotonicNow() }
        )

        try stateMachine.dispatch(.sessionInit)

        unsubscribeLifecycle = platform.lifecycle.subscribe(LifecycleHandlers(
            // A hidden app may be terminated without another signal.
            onHidden: onLifecycle({ [self] in try flushCounted() }, .visibilityHidden),
            onUnload: onLifecycle({ [self] in
                try flushCounted()
                try stateMachine.dispatch(.pageHide, captureContext)
            }, .pagehide),
            onSuspend: onLifecycle({ [self] in
                try flushCounted()
                try stateMachine.dispatch(.pageSuspend, captureContext)
            }, .pagehide)
        ))

        unsubscribe = player.subscribe { [self] sig in
            do {
                try onSignal(sig)
            } catch {
                internalError(error)
            }
        }
    }

    private func warn(_ message: String, _ data: Any? = nil) {
        platform.log(.warn, message, data)
    }

    private func debug(_ message: String, _ data: Any? = nil) {
        if userConfig.debug { platform.log(.debug, message, data) }
    }

    private func internalError(_ err: any Error) {
        warn("internal error; some analytics may be missing", err)
    }

    private func capturePlayerUiContext() {
        let ui = player.getUiContext()
        let w = ui.width ?? 0
        let h = ui.height ?? 0
        if w > 0 { context.playerWidthPixels = jsRound(w) }
        if h > 0 { context.playerHeightPixels = jsRound(h) }
        if let autoplay = ui.autoplay { context.playerAutoplay = autoplay }
        if let preload = ui.preload { context.playerPreload = preload }
    }

    private func pushEvent(_ event: AnalyticsEvent) throws {
        debug("event \(event.event.rawValue)", event)
        try batchQueue.push(encodeEventRowV1(event, clock.now()), context)
    }

    private func captureContext() -> AnalyticsEventFields {
        let snapshot = player.getSnapshot()
        return AnalyticsEventFields(
            videoSourceUrl: viewSourceUrl,
            videoWidthPixels: jsTruthyNumber(snapshot.videoWidth),
            videoHeightPixels: jsTruthyNumber(snapshot.videoHeight),
            videoTotalDurationMs: secondsToMs(snapshot.duration),
            playbackTimeInstantMs: secondsToMs(player.getCurrentTime()),
            playingTimeMs: playedTime.total,
            videoUpscalePercentage: snapshot.upscalePercentage,
            videoDownscalePercentage: snapshot.downscalePercentage,
            audioCodec: snapshot.audioCodec,
            videoCodec: snapshot.videoCodec
        )
    }

    /// Rotates the session when the persisted one has expired: closes the current view
    /// (`viewend(sessionrotate)`) and opens a warm-resume view. Called only on user-intent
    /// signals (load_start / play / seeking) so background events like `pause` or
    /// `timeupdate` never rotate. Touches `last_activity` (throttled) on every call.
    private func checkSessionRotation() throws {
        let previousSessionId = context.sessionId
        let resolution = sessionStore.resolve(clock.now())
        if !resolution.rotated { return }
        let identity = resolution.identity
        // Defer applying the new identity until onSessionInit: mutating context here would
        // stamp the OLD view's closing viewend with the new session_id.
        pendingRotation = PendingRotation(
            sessionId: identity.sessionId,
            sessionStartDate: identity.sessionStartDate,
            sessionStartTimeIso: isoString(identity.sessionStartTimeMs)
        )
        try stateMachine.dispatch(
            .sessionRotated(previousSessionId: previousSessionId, videoSourceUrl: viewSourceUrl),
            captureContext
        )
        playedTime.resetTotal()
    }

    /// Runs the user's `mapError`, then dispatches. `native` errors end the view;
    /// `report` errors (from `reportError`) leave it open.
    private func dispatchError(_ error: AnalyticsErrorInfo, _ kind: ErrorKind) throws {
        var code = error.code
        var message = error.message
        var errCtx = error.context
        if let mapError = userConfig.mapError {
            do {
                if let mapped = try mapError(AnalyticsErrorInfo(code: code, message: message, context: errCtx)) {
                    if let mappedCode = mapped.code { code = mappedCode }
                    if let mappedMessage = mapped.message { message = mappedMessage }
                    if let mappedContext = mapped.context { errCtx = mappedContext }
                }
            } catch {
                warn("mapError threw; reporting the unmapped error", error)
            }
        }
        let errorCode = code.isEmpty ? "UNKNOWN" : code
        try stateMachine.dispatch(
            kind == .report
                ? .reportError(errorCode: errorCode, errorMessage: message, errorContext: errCtx)
                : .error(errorCode: errorCode, errorMessage: message, errorContext: errCtx),
            captureContext
        )
    }

    private func currentTimeMsOrZero() -> Double {
        secondsToMs(player.getCurrentTime()) ?? 0
    }

    private func readBitrate() -> Double? {
        windowBitrate = player.getBitrate()
        return windowBitrate
    }

    private func readRate() -> Double {
        let rate = player.getPlaybackRate()
        if let rate, rate > 0 { return rate }
        return 1
    }

    /// Sends the time counted since the last row as a `timeupdate`, weighted with `bitrate`.
    /// A nil `bitrate` reads the current one, as the TS default parameter does for `undefined`.
    private func report(_ bitrateArg: Double? = nil) throws {
        let bitrate = bitrateArg ?? readBitrate()
        // The state machine drops timeupdate outside `playing`; the time stays for the next row.
        if !stateMachine.isPlaying() { return }
        lastReportMonotonic = clock.monotonicNow()
        try stateMachine.dispatch(
            .timeupdate(
                playbackTimeMs: playedTime.position,
                playingTimeMs: playedTime.total,
                playedDeltaMs: playedTime.takeUnreported(),
                bitrate: bitrate
            ),
            captureContext
        )
    }

    private func tick() {
        playedTime.tick(currentTimeMsOrZero(), clock.monotonicNow(), readRate())
    }

    private func onTick() throws {
        if !playedTime.isCounting { return }
        tick()
        let due = clock.monotonicNow() - lastReportMonotonic >= analyticsTimeupdateThrottleMs
        if due && playedTime.hasUnreported { try report() }
    }

    private func startCounting() {
        if !stateMachine.isPlaying() { return }
        playedTime.start(currentTimeMsOrZero(), clock.monotonicNow(), readRate())
        if stopTicks == nil {
            stopTicks = scheduleRepeating(
                clock,
                { [weak self] in
                    guard let self else { return }
                    do {
                        try onTick()
                    } catch {
                        internalError(error)
                    }
                },
                everyMs: analyticsPlayheadTickMs
            )
        }
    }

    private func stopTimer() {
        stopTicks?()
        stopTicks = nil
    }

    /// Counts up to where playback stopped and sends it before the stop is dispatched.
    private func stopCounting() throws {
        stopTimer()
        playedTime.stop(currentTimeMsOrZero(), clock.monotonicNow(), readRate())
        if playedTime.hasUnreported { try report() }
    }

    /// Same, at a seek or source change, where the player already reports the new position.
    /// Returns the position left.
    private func stopCountingAtJump(_ knownFromMs: Double? = nil) throws -> Double {
        stopTimer()
        let fromMs = playedTime.seek(clock.monotonicNow(), knownFromMs)
        if playedTime.hasUnreported { try report() }
        return fromMs
    }

    /// Sends what played up to now without stopping counting.
    private func flushCounted(_ bitrateArg: Double? = nil) throws {
        let bitrate = bitrateArg ?? readBitrate()
        tick()
        if playedTime.hasUnreported { try report(bitrate) }
    }

    private func onSignal(_ sig: PlayerSignal) throws {
        switch sig {
        case .playerReady:
            capturePlayerUiContext()
            let playerReadyMonotonic = clock.monotonicNow()
            let playerStartupMs = jsRound(playerReadyMonotonic - initMonotonicMs)
            let pageLoadMs = platform.getPageLoadTimeMs(initMonotonicMs)
            try stateMachine.dispatch(.playerReady(playerStartupTimeMs: playerStartupMs, pageLoadTimeMs: pageLoadMs))

        case .loadStart(let sourceUrl, let sigSourceKey):
            _ = try stopCountingAtJump()
            try checkSessionRotation()
            let videoSourceUrl = sourceUrl
            let prevSourceUrl = viewSourceUrl
            let sourceKey = sigSourceKey?.isEmpty == false ? sigSourceKey! : videoSourceUrl
            let isVideoChange = !sourceKey.isEmpty && viewSourceKey?.isEmpty == false && sourceKey != viewSourceKey

            viewSourceUrl = videoSourceUrl
            viewSourceKey = sourceKey
            player.resetSourceState()

            try stateMachine.dispatch(
                .loadStart(
                    videoSourceUrl: videoSourceUrl,
                    previousVideoSourceUrl: prevSourceUrl,
                    isVideoChange: isVideoChange
                ),
                captureContext
            )
            // Reset only now: the old view's closing viewend above still reports its playing time.
            playedTime.resetTotal()
            playedTime.position = 0
            resumeCountingAfterSeek = false
            lastReportMonotonic = clock.monotonicNow()

        case .play:
            try checkSessionRotation()
            try stateMachine.dispatch(.play, captureContext)

        case .playing:
            try stateMachine.dispatch(.playing, captureContext)
            startCounting()
            _ = readBitrate()

        case .renditionChange:
            // Close the window at the switch so the time on the old rendition is weighted with its bitrate.
            try flushCounted(windowBitrate)
            try stateMachine.dispatch(.renditionchange(bitrate: readBitrate()), captureContext)

        case .pause:
            try stopCounting()
            try stateMachine.dispatch(.pause, captureContext)

        case .timeupdate:
            try onTick()

        case .seeking(let fromTime):
            // A drag sends several `seeking`s; only the first sees whether playback was running.
            if playedTime.isCounting { resumeCountingAfterSeek = true }
            let fromMs = try stopCountingAtJump(secondsToMs(fromTime))
            try checkSessionRotation()
            try stateMachine.dispatch(.seeking(fromPositionMs: fromMs), captureContext)

        case .seeked:
            let toMs = currentTimeMsOrZero()
            playedTime.position = toMs
            try stateMachine.dispatch(.seeked(toPositionMs: toMs), captureContext)
            if resumeCountingAfterSeek { startCounting() }
            resumeCountingAfterSeek = false

        case .waiting:
            try stopCounting()
            try stateMachine.dispatch(.waiting, captureContext)
            // Report the stall once it has lasted the minimum; a shorter one is dropped when it closes.
            _ = clock.schedule({ [weak self] in
                guard let self else { return }
                do {
                    try stateMachine.dispatch(.rebufferCheck, captureContext)
                } catch {
                    internalError(error)
                }
            }, delayMs: analyticsMinRebufferMs)

        case .ended:
            try stopCounting()
            try stateMachine.dispatch(.ended, captureContext)

        case .error(let error):
            try stopCounting()
            try dispatchError(error, .native)

        case .dispose:
            try stopCounting()
            try stateMachine.dispatch(.dispose, captureContext)
            batchQueue.dispose()
            unsubscribeLifecycle?()
        }
    }

    // Count the time played so far, emit the closing event if any, then ship: the rows these steps
    // add go out in the same flush. Each step is isolated so a failure still ships what is queued.
    private func onLifecycle(
        _ beforeFlush: @escaping @MainActor () throws -> Void,
        _ reason: FlushReason
    ) -> @MainActor () -> Void {
        { [self] in
            do {
                try beforeFlush()
            } catch {
                internalError(error)
            }
            batchQueue.flush(reason)
        }
    }

    func reportError(_ error: AnalyticsErrorInfo) {
        do {
            try dispatchError(
                AnalyticsErrorInfo(code: error.code, message: error.message, context: error.context),
                .report
            )
        } catch {
            internalError(error)
        }
    }

    func setCustomDimensions(_ dims: [String: String]) {
        // Context travels per batch, so ship queued events before their dimensions change.
        batchQueue.flush(.manual)
        context.customDimensions = sanitizeCustomDimensions(dims) { warn($0) }
    }

    func getCustomDimensions() -> [String: String] {
        context.customDimensions ?? [:]
    }

    func dispose() {
        do {
            // Same as the player's dispose signal: apps often tear the tracker down without one.
            try onSignal(.dispose)
        } catch {
            internalError(error)
        }
        unsubscribe?()
    }
}
