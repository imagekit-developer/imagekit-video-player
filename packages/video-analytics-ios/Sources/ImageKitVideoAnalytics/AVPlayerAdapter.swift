#if os(iOS)
import AVFoundation
import AVKit
import ImageKitVideoAnalyticsCore
import UIKit

/// Where the video is painted, for the player size and scale percentages.
@MainActor
enum PlayerSurface {
    case layer(AVPlayerLayer)
    case viewController(AVPlayerViewController)
    case size(CGSize)
}

private struct Variant {
    var height: Int
    var bitrate: Double
}

/// Binds an `AVPlayer` to the tracker (see DECISIONS "Signals from AVPlayer"). Holds the player
/// weakly and every observer it adds is removed on unsubscribe.
@MainActor
final class AVPlayerAdapter: AnalyticsPlayer {
    let software = "AVPlayer"
    let softwareVersion = UIDevice.current.systemVersion

    private weak var player: AVPlayer?
    private weak var layer: AVPlayerLayer?
    private weak var viewController: AVPlayerViewController?
    private var playerSize: CGSize?
    private let monotonicNow: @MainActor () -> Double

    private var listener: (@MainActor (PlayerSignal) -> Void)?
    /// Called after a signal that stops playback or ends a view, so a backgrounded app ships it at once.
    var onPlaybackStopped: (@MainActor () -> Void)?

    private var playerObservations: [NSKeyValueObservation] = []
    private var itemObservations: [NSKeyValueObservation] = []
    private var itemNotificationTokens: [NSObjectProtocol] = []
    private var timeObserver: Any?
    private weak var timeObserverPlayer: AVPlayer?
    private weak var observedItem: AVPlayerItem?
    private var probeTimer: DispatchWorkItem?

    private var detector = SeekDetector()
    /// What the tracker was last told: stopped (initially, after pause / ended / error) or playing.
    private var reportedStopped = true
    /// `play` sent; `playing` follows once the clock runs past `playingFrom`.
    private var playingPending = false
    private var playingFrom = 0.0
    private var waitingReported = false
    private var hasPlayedItem = false
    private var errorReported = false

    private var sourceGeneration = 0
    private var videoCodec: String?
    private var audioCodec: String?
    private var variants: [Variant] = []
    private var progressiveBitrate: Double?
    private var lastPresentationSize = CGSize.zero

    init(player: AVPlayer, surface: PlayerSurface, monotonicNow: @escaping @MainActor () -> Double) {
        self.player = player
        self.monotonicNow = monotonicNow
        switch surface {
        case .layer(let layer): self.layer = layer
        case .viewController(let viewController): self.viewController = viewController
        case .size(let size): playerSize = size
        }
    }

    func setPlayerSize(_ size: CGSize) {
        playerSize = size
    }

    // MARK: AnalyticsPlayer

    func subscribe(_ listener: @escaping @MainActor (PlayerSignal) -> Void) -> @MainActor () -> Void {
        self.listener = listener
        return { [weak self] in self?.stop() }
    }

    func getUiContext() -> PlayerUiContext {
        guard let size = surfaceSize() else { return PlayerUiContext() }
        return PlayerUiContext(width: Double(size.width), height: Double(size.height))
    }

    func getSnapshot() -> PlaybackSnapshot {
        guard let item = player?.currentItem else { return PlaybackSnapshot() }
        let size = item.presentationSize
        let scale = scalePercentages(size)
        return PlaybackSnapshot(
            videoWidth: Double(size.width),
            videoHeight: Double(size.height),
            duration: item.duration.seconds,
            upscalePercentage: scale.videoUpscalePercentage,
            downscalePercentage: scale.videoDownscalePercentage,
            audioCodec: audioCodec,
            videoCodec: videoCodec
        )
    }

    func getCurrentTime() -> Double? {
        guard let player, player.currentItem != nil else { return nil }
        let seconds = player.currentTime().seconds
        return seconds.isFinite ? seconds : nil
    }

    func getPlaybackRate() -> Double? {
        player.map { Double($0.rate) }
    }

    /// The variant whose resolution is on screen (as web matches the decoded height); for mp4, the
    /// access log's file bitrate.
    func getBitrate() -> Double? {
        guard let item = player?.currentItem else { return nil }
        let height = Int(item.presentationSize.height.rounded())
        if height > 0, let variant = variants.first(where: { $0.height == height }) { return variant.bitrate }
        if let progressiveBitrate { return progressiveBitrate }
        guard let event = item.accessLog()?.events.last, event.indicatedBitrate > 0 else { return nil }
        if event.playbackType == "FILE" { progressiveBitrate = event.indicatedBitrate }
        return event.indicatedBitrate
    }

    func resetSourceState() {
        sourceGeneration += 1
        videoCodec = nil
        audioCodec = nil
        variants = []
        progressiveBitrate = nil
        lastPresentationSize = .zero
    }

    // MARK: Lifecycle

    func emitPlayerReady() {
        listener?(.playerReady)
    }

    /// Starts observing; the current item, if any, opens a view.
    func start() {
        guard listener != nil, let player else { return }
        playerObservations = [
            player.observe(\.currentItem, options: [.initial, .new]) { [weak self] _, _ in
                onMain { self?.currentItemChanged() }
            },
            player.observe(\.rate, options: [.old, .new]) { [weak self] _, change in
                guard let old = change.oldValue, let new = change.newValue, old != new else { return }
                onMain { self?.rateChanged(from: old, to: new) }
            },
            player.observe(\.timeControlStatus, options: [.new]) { [weak self] _, _ in
                onMain { self?.timeControlStatusChanged() }
            },
            player.observe(\.reasonForWaitingToPlay, options: [.new]) { [weak self] _, _ in
                onMain { self?.timeControlStatusChanged() }
            },
        ]
        timeObserver = player.addPeriodicTimeObserver(
            forInterval: CMTime(value: 1, timescale: 10),
            queue: .main
        ) { [weak self] time in
            let seconds = time.seconds
            MainActor.assumeIsolated { self?.periodicTick(seconds) }
        }
        timeObserverPlayer = player
    }

    private func stop() {
        listener = nil
        onPlaybackStopped = nil
        playerObservations.forEach { $0.invalidate() }
        playerObservations = []
        detachItem()
        if let timeObserver, let owner = timeObserverPlayer {
            owner.removeTimeObserver(timeObserver)
        }
        timeObserver = nil
        timeObserverPlayer = nil
        probeTimer?.cancel()
        probeTimer = nil
    }

    // MARK: Signals

    private func emit(_ signal: PlayerSignal) {
        guard let listener else { return }
        listener(signal)
        switch signal {
        case .pause, .ended, .error, .loadStart:
            onPlaybackStopped?()
        default:
            break
        }
    }

    private func currentSeconds() -> Double {
        guard let seconds = player?.currentTime().seconds, seconds.isFinite else { return 0 }
        return seconds
    }

    private func currentRate() -> Double {
        Double(player?.rate ?? 0)
    }

    private func emitSeekOutputs(_ outputs: [SeekDetector.Output]) {
        for output in outputs {
            switch output {
            case .seeking(let from):
                emit(.seeking(fromTime: from))
            case .seeked:
                emit(.seeked)
                reconcileAfterSeek()
            }
        }
        scheduleProbe()
    }

    private func scheduleProbe() {
        guard detector.awaitsRunningClock, probeTimer == nil else { return }
        let item = DispatchWorkItem { [weak self] in
            MainActor.assumeIsolated { self?.probeRunningClock() }
        }
        probeTimer = item
        DispatchQueue.main.asyncAfter(deadline: .now() + .milliseconds(Int(SeekDetector.runningProbeMs)), execute: item)
    }

    private func probeRunningClock() {
        probeTimer = nil
        guard listener != nil, player?.currentItem != nil else { return }
        emitSeekOutputs(detector.probe(currentTime: currentSeconds(), rate: currentRate(), nowMs: monotonicNow()))
    }

    /// Play and pause requested during a seek were held; tell the tracker where playback is now.
    private func reconcileAfterSeek() {
        guard let player, player.currentItem != nil else { return }
        if player.rate == 0, !reportedStopped {
            reportStopped(.pause)
        } else if player.rate != 0, reportedStopped {
            reportPlay()
        }
    }

    private func reportPlay() {
        reportedStopped = false
        playingPending = true
        playingFrom = currentSeconds()
        emit(.play)
    }

    private func reportStopped(_ signal: PlayerSignal) {
        reportedStopped = true
        playingPending = false
        waitingReported = false
        emit(signal)
    }

    private func observeReading() {
        guard player?.currentItem != nil else { return }
        emitSeekOutputs(detector.observe(currentTime: currentSeconds(), rate: currentRate(), nowMs: monotonicNow()))
    }

    private func currentItemChanged() {
        guard listener != nil, let player else { return }
        detachItem()
        let item = player.currentItem
        detector.reset(position: item == nil ? nil : currentSeconds(), rate: currentRate(), nowMs: monotonicNow())
        guard let item else { return }
        reportedStopped = true
        playingPending = false
        waitingReported = false
        hasPlayedItem = false
        errorReported = false
        let url = (item.asset as? AVURLAsset)?.url.absoluteString ?? ""
        emit(.loadStart(sourceUrl: url))
        attachItem(item)
        if player.rate != 0 { reportPlay() }
    }

    private func rateChanged(from old: Float, to new: Float) {
        guard let player, player.currentItem != nil else { return }
        observeReading()
        if old == 0 {
            if !detector.isSeeking, reportedStopped { reportPlay() }
        } else if new == 0 {
            if !detector.isSeeking, !reportedStopped { reportStopped(.pause) }
        }
    }

    private func timeControlStatusChanged() {
        guard let player, player.currentItem != nil else { return }
        observeReading()
        guard player.timeControlStatus == .waitingToPlayAtSpecifiedRate,
              player.reasonForWaitingToPlay == .toMinimizeStalls,
              hasPlayedItem, !reportedStopped, !waitingReported, !detector.isSeeking
        else { return }
        waitingReported = true
        playingPending = true
        playingFrom = currentSeconds()
        emit(.waiting)
    }

    private func periodicTick(_ time: Double) {
        guard let player, player.currentItem != nil, time.isFinite else { return }
        let currentTime = currentSeconds()
        let rate = currentRate()
        emitSeekOutputs(detector.tick(time: time, currentTime: currentTime, rate: rate, nowMs: monotonicNow()))
        if detector.isSeeking { return }
        if playingPending, rate != 0, abs(currentTime - time) <= SeekDetector.jumpTolerance, time > playingFrom + 0.001 {
            playingPending = false
            waitingReported = false
            hasPlayedItem = true
            emit(.playing)
        }
        emit(.timeupdate)
    }

    private func didPlayToEnd(_ item: AVPlayerItem) {
        let duration = item.duration.seconds
        let position = duration.isFinite && duration > 0 ? duration : currentSeconds()
        emitSeekOutputs(detector.didPlayToEnd(position: position, nowMs: monotonicNow()))
        reportStopped(.ended)
    }

    private func reportFatalError(_ error: (any Error)?, _ source: PlayerErrorSource, _ item: AVPlayerItem) {
        if errorReported { return }
        errorReported = true
        let info = playerErrorInfo(
            error,
            source: source,
            playheadSeconds: player?.currentTime().seconds,
            errorLogUri: item.errorLog()?.events.last?.uri
        )
        reportStopped(.error(info))
    }

    // MARK: Item

    private func attachItem(_ item: AVPlayerItem) {
        observedItem = item
        itemObservations = [
            item.observe(\.status, options: [.initial, .new]) { [weak self] _, _ in
                onMain { self?.itemStatusChanged() }
            },
            item.observe(\.presentationSize, options: [.initial, .new]) { [weak self] _, _ in
                onMain { self?.presentationSizeChanged() }
            },
            item.observe(\.tracks, options: [.initial, .new]) { [weak self] _, _ in
                onMain { self?.readCodecs() }
            },
        ]
        let center = NotificationCenter.default
        itemNotificationTokens = [
            center.addObserver(forName: AVPlayerItem.didPlayToEndTimeNotification, object: item, queue: .main) {
                [weak self, weak item] _ in
                MainActor.assumeIsolated {
                    guard let self, let item, item === self.observedItem else { return }
                    self.didPlayToEnd(item)
                }
            },
            center.addObserver(forName: AVPlayerItem.failedToPlayToEndTimeNotification, object: item, queue: .main) {
                [weak self, weak item] note in
                let error = note.userInfo?[AVPlayerItemFailedToPlayToEndTimeErrorKey] as? NSError
                MainActor.assumeIsolated {
                    guard let self, let item, item === self.observedItem else { return }
                    self.reportFatalError(error, .failedToPlayToEnd, item)
                }
            },
            center.addObserver(forName: AVPlayerItem.timeJumpedNotification, object: item, queue: .main) {
                [weak self] _ in
                MainActor.assumeIsolated { self?.observeReading() }
            },
        ]
        loadVariants(item)
    }

    private func detachItem() {
        itemObservations.forEach { $0.invalidate() }
        itemObservations = []
        itemNotificationTokens.forEach { NotificationCenter.default.removeObserver($0) }
        itemNotificationTokens = []
        observedItem = nil
    }

    private func itemStatusChanged() {
        guard let item = observedItem, item.status == .failed else { return }
        reportFatalError(item.error, .itemStatusFailed, item)
    }

    private func presentationSizeChanged() {
        guard let size = observedItem?.presentationSize, size.width > 0, size.height > 0 else { return }
        let previous = lastPresentationSize
        lastPresentationSize = size
        if previous.width > 0, previous != size { emit(.renditionChange) }
    }

    /// Item tracks follow the variant being loaded and work without `CODECS` in the playlist.
    private func readCodecs() {
        guard let item = observedItem else { return }
        for track in item.tracks where track.isEnabled {
            guard let assetTrack = track.assetTrack,
                  let descriptions = assetTrack.formatDescriptions as? [CMFormatDescription],
                  let first = descriptions.first,
                  let codec = codecString(first)
            else { continue }
            switch assetTrack.mediaType {
            case .video: videoCodec = codec
            case .audio: audioCodec = codec
            default: break
            }
        }
    }

    private func loadVariants(_ item: AVPlayerItem) {
        guard let asset = item.asset as? AVURLAsset else { return }
        let generation = sourceGeneration
        asset.loadValuesAsynchronously(forKeys: ["variants"]) { [weak self] in
            onMain {
                guard let self, generation == self.sourceGeneration,
                      asset.statusOfValue(forKey: "variants", error: nil) == .loaded
                else { return }
                self.variants = asset.variants.compactMap { variant in
                    guard let height = variant.videoAttributes?.presentationSize.height, height > 0,
                          let bitrate = variant.peakBitRate, bitrate > 0
                    else { return nil }
                    return Variant(height: Int(height.rounded()), bitrate: bitrate)
                }
            }
        }
    }

    // MARK: Surface

    private func surfaceSize() -> CGSize? {
        if let layer { return layer.bounds.size }
        if let viewController { return viewController.viewIfLoaded?.bounds.size }
        return playerSize
    }

    private func scalePercentages(_ source: CGSize) -> ScalePercentages {
        let painted: CGRect
        let gravity: AVLayerVideoGravity
        if let layer {
            painted = layer.videoRect
            gravity = layer.videoGravity
        } else if let viewController {
            painted = viewController.videoBounds
            gravity = viewController.videoGravity
        } else if let playerSize {
            painted = CGRect(origin: .zero, size: playerSize)
            gravity = .resizeAspect
        } else {
            return computeScalePercentages(0, 0, 0, 0)
        }
        // `videoRect` / `videoBounds` are already fitted; only `.resize` scales the axes apart.
        return computeScalePercentages(
            Double(source.width),
            Double(source.height),
            Double(painted.width),
            Double(painted.height),
            fit: gravity == .resize ? "fill" : "contain"
        )
    }

    // MARK: seek(to:)

    func seek(
        to time: CMTime,
        toleranceBefore: CMTime?,
        toleranceAfter: CMTime?,
        completionHandler: (@Sendable (Bool) -> Void)?
    ) {
        guard let player else {
            completionHandler?(false)
            return
        }
        let generation: Int?
        if listener != nil, player.currentItem != nil {
            let began = detector.wrapperBegan(currentTime: currentSeconds(), nowMs: monotonicNow())
            generation = began.generation
            emitSeekOutputs(began.outputs)
        } else {
            generation = nil
        }
        let done: @Sendable (Bool) -> Void = { [weak self] finished in
            onMain {
                if let generation { self?.wrapperSeekCompleted(generation, finished) }
                completionHandler?(finished)
            }
        }
        if let toleranceBefore, let toleranceAfter {
            player.seek(to: time, toleranceBefore: toleranceBefore, toleranceAfter: toleranceAfter, completionHandler: done)
        } else {
            player.seek(to: time, completionHandler: done)
        }
    }

    private func wrapperSeekCompleted(_ generation: Int, _ finished: Bool) {
        guard listener != nil else { return }
        emitSeekOutputs(detector.wrapperCompleted(
            generation: generation,
            finished: finished,
            currentTime: currentSeconds(),
            rate: currentRate(),
            nowMs: monotonicNow()
        ))
    }
}
#endif
