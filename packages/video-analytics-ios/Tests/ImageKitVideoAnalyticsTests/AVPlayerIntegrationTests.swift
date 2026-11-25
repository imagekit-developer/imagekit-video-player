// A real AVPlayer and the real tracker on the iOS Simulator, against ImageKit and Apple test streams
// (network required). Events are captured from the tracker's debug log as they are made, and the
// rows from a capturing transport, so the two can be compared after dispose.
#if os(iOS)
import AVFoundation
import ImageKitVideoAnalyticsCore
import UIKit
import XCTest
@testable import ImageKitVideoAnalytics

private let mp4Url = URL(string: "https://ik.imagekit.io/ikmedia/Internal%20Videos/VideoPlayerAnalytics/SampleDemonstration.mp4")!
private let imagekitHlsUrl = URL(
    string: "https://ik.imagekit.io/ikmedia/Internal%20Videos/VideoPlayerAnalytics/SampleDemonstration.mp4/ik-master.m3u8?tr=sr-240_360_480_720"
)!
private let bipbopHlsUrl = URL(
    string: "https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8"
)!
private let missingMp4Url = URL(string: "https://ik.imagekit.io/ikmedia/nonexistent-video-analytics-ios-test.mp4")!

@MainActor
private final class CapturingTransport: AnalyticsTransport {
    var requests: [IKAnalyticsIngestRequestV1] = []

    var supportsCompression: Bool {
        true
    }

    func send(
        _ request: IKAnalyticsIngestRequestV1,
        options: AnalyticsSendOptions,
        completion: @escaping @MainActor (Result<SentBeacon, any Error>) -> Void
    ) {
        requests.append(request)
        completion(.success(SentBeacon(jsonBytes: 0, urlBytes: 0, gzipped: true)))
    }

    var rowEventNames: [String] {
        requests.flatMap { $0.e.map { $0[eventFieldsV1.firstIndex(of: "event")!] as? String ?? "?" } }
    }
}

@MainActor
private final class Harness {
    let player = AVPlayer()
    let transport = CapturingTransport()
    let platform: IOSPlatform
    private(set) var events: [AnalyticsEvent] = []
    private(set) var monitor: ImageKitVideoAnalytics.Monitor!

    init(
        _ url: URL?,
        surface: PlayerSurface = .size(CGSize(width: 390, height: 219)),
        backgroundTasks: BackgroundTasks = .application
    ) {
        player.isMuted = true
        platform = IOSPlatform(transport: transport, backgroundTasks: backgroundTasks)
        platform.logObserver = { [weak self] _, _, data in
            if let event = data as? AnalyticsEvent { self?.events.append(event) }
        }
        if let url { player.replaceCurrentItem(with: AVPlayerItem(url: url)) }
        monitor = ImageKitVideoAnalytics.monitor(
            player: player,
            surface: surface,
            imagekitId: "ios-sdk-test",
            config: ImageKitVideoAnalytics.Config(debug: true),
            platform: platform
        )
    }

    var names: [String] {
        events.map(\.event.rawValue)
    }

    func named(_ name: String) -> [AnalyticsEvent] {
        events.filter { $0.event.rawValue == name }
    }

    func wait(_ seconds: Double) {
        RunLoop.main.run(until: Date().addingTimeInterval(seconds))
    }

    @discardableResult
    func waitUntil(_ timeout: Double, _ condition: () -> Bool) -> Bool {
        let deadline = Date().addingTimeInterval(timeout)
        while !condition(), Date() < deadline {
            RunLoop.main.run(until: Date().addingTimeInterval(0.02))
        }
        return condition()
    }

    /// Waits for the `count`-th event named `name`.
    @discardableResult
    func waitFor(_ name: String, count: Int = 1, timeout: Double = 25) -> AnalyticsEvent? {
        waitUntil(timeout) { named(name).count >= count }
        let matches = named(name)
        return matches.count >= count ? matches[count - 1] : nil
    }

    func waitReady() {
        waitUntil(25) { player.currentItem?.status == .readyToPlay }
    }

    func seconds() -> Double {
        player.currentTime().seconds
    }

    func dispose(_ test: String = #function) {
        monitor.dispose()
        player.pause()
        player.replaceCurrentItem(with: nil)
        print("TRACE \(test): " + events.map(Self.describe).joined(separator: " | "))
    }

    private static func describe(_ e: AnalyticsEvent) -> String {
        var parts = [e.event.rawValue, "+\(Int(e.msFromPreviousEvent))ms"]
        if let v = e.playbackTimeInstantMs { parts.append("at=\(Int(v))") }
        if let v = e.fromPositionMs { parts.append("from=\(Int(v))") }
        if let v = e.toPositionMs { parts.append("to=\(Int(v))") }
        if let v = e.seekTimeMs { parts.append("seek=\(Int(v))") }
        if let v = e.videoStartupTimeMs { parts.append("startup=\(Int(v))") }
        if let v = e.playedDeltaMs { parts.append("delta=\(Int(v))") }
        if let v = e.bitrate { parts.append("br=\(Int(v))") }
        if e.event == .renditionchange || e.event == .viewstarted {
            parts.append("\(Int(e.videoWidthPixels ?? 0))x\(Int(e.videoHeightPixels ?? 0)) \(e.videoCodec ?? "-")/\(e.audioCodec ?? "-")")
        }
        if let v = e.errorCode { parts.append("code=\(v)") }
        if let v = e.viewEndReason { parts.append("reason=\(v.rawValue)") }
        return parts.joined(separator: " ")
    }
}

/// When a seek's completion handler ran, on the tracker's clock.
private final class Completion: @unchecked Sendable {
    var ms: Double?

    func handler(_: Bool) {
        ms = SystemClock.monotonicMs()
    }
}

/// Played time missing at `pause` after a seek that landed at `landedMs`: what played before the seek
/// (counted at `seeking`) plus the playhead's run from the landing point, minus what was counted.
private func playedTimeLost(seeking: AnalyticsEvent, landedMs: Double, pause: AnalyticsEvent) -> Double {
    (seeking.playingTimeMs ?? 0) + (pause.playbackTimeInstantMs ?? 0) - landedMs - (pause.playingTimeMs ?? 0)
}

private func assertSubsequence(
    _ names: [String],
    _ expected: [String],
    file: StaticString = #filePath,
    line: UInt = #line
) {
    var index = names.startIndex
    for name in expected {
        guard let found = names[index...].firstIndex(of: name) else {
            return XCTFail("\(expected) is not a subsequence of \(names)", file: file, line: line)
        }
        index = found + 1
    }
}

@MainActor
final class AVPlayerIntegrationTests: XCTestCase {
    func testStartAndPlayMp4() throws {
        let h = Harness(mp4Url)
        h.player.play()
        XCTAssertNotNil(h.waitFor("playing"), "\(h.names)")
        h.wait(2.6)
        h.dispose()

        XCTAssertEqual(Array(h.names.prefix(6)), ["sessioninit", "playerready", "viewinit", "play", "viewstarted", "playing"])
        let ready = try XCTUnwrap(h.named("playerready").first)
        XCTAssertEqual(ready.playerStartupTimeMs, 0)
        XCTAssertEqual(ready.pageLoadTimeMs, 0)
        XCTAssertEqual(h.named("viewinit").first?.videoSourceUrl, mp4Url.absoluteString)
        XCTAssertGreaterThan(h.named("viewstarted").first?.videoStartupTimeMs ?? 0, 0)
        let update = try XCTUnwrap(h.named("timeupdate").first)
        XCTAssertGreaterThan(update.bitrate ?? 0, 0)
        XCTAssertGreaterThan(update.playedDeltaMs ?? 0, 500)
        XCTAssertEqual(update.videoCodec, "avc1.640034")
        XCTAssertEqual(update.audioCodec, "mp4a.40.2")
        XCTAssertGreaterThan(update.videoWidthPixels ?? 0, 0)
        XCTAssertGreaterThan(update.videoDownscalePercentage ?? 0, 0)
        XCTAssertEqual(h.events.last?.event, .viewend)
        XCTAssertEqual(h.events.last?.viewEndReason, .dispose)
        XCTAssertTrue(h.names.allSatisfy { !["seeking", "seeked", "pause", "rebufferstart", "error"].contains($0) }, "\(h.names)")

        XCTAssertEqual(h.transport.rowEventNames, h.names)
        let context = try XCTUnwrap(h.transport.requests.last?.c)
        XCTAssertEqual(context["psw"] as? String, "AVPlayer")
        XCTAssertEqual(context["psv"] as? String, UIDevice.current.systemVersion)
        XCTAssertEqual(context["ip"] as? String, "imagekit-video-analytics-ios")
        XCTAssertEqual(context["ipv"] as? String, ImageKitVideoAnalytics.version)
        XCTAssertEqual(context["url"] as? String, "")
        XCTAssertEqual((context["pw"] as? NSNumber)?.doubleValue, 390)
        XCTAssertTrue((context["ua"] as? String)?.hasPrefix("Mozilla/5.0 (iPhone; CPU iPhone OS ") == true)
    }

    func testPauseAndResume() {
        let h = Harness(mp4Url)
        h.player.play()
        h.waitFor("playing")
        h.wait(1.2)
        h.player.pause()
        h.wait(1)
        h.player.play()
        h.waitFor("playing", count: 2)
        h.wait(0.5)
        h.dispose()
        assertSubsequence(h.names, ["viewstarted", "playing", "pause", "play", "playing"])
        XCTAssertEqual(h.named("pause").count, 1, "\(h.names)")
        XCTAssertTrue(h.named("seeking").isEmpty, "\(h.names)")
    }

    func testSeekWhilePlayingViaWrapper() throws {
        let h = Harness(mp4Url)
        h.player.play()
        h.waitFor("playing")
        h.wait(2)
        let from = h.seconds()
        let completion = Completion()
        let started = SystemClock.monotonicMs()
        h.monitor.seek(to: CMTime(seconds: 30, preferredTimescale: 600), completionHandler: completion.handler)
        let seeked = try XCTUnwrap(h.waitFor("seeked", timeout: 10), "\(h.names)")
        h.wait(1)
        h.player.pause()
        let pause = try XCTUnwrap(h.waitFor("pause", timeout: 2), "\(h.names)")
        h.dispose()
        let seeking = try XCTUnwrap(h.named("seeking").first)
        XCTAssertEqual(h.named("seeking").count, 1, "\(h.names)")
        XCTAssertEqual(h.named("seeked").count, 1, "\(h.names)")
        XCTAssertEqual(seeking.fromPositionMs ?? 0, from * 1000, accuracy: 150)
        XCTAssertEqual(seeked.toPositionMs ?? 0, 30000, accuracy: 600)
        // The wrapper sends `seeking` at the call; `seeked` comes once the clock runs at the target,
        // which is after the completion handler.
        let real = try XCTUnwrap(completion.ms) - started
        let seekTime = try XCTUnwrap(seeked.seekTimeMs)
        let lost = playedTimeLost(seeking: seeking, landedMs: 30000, pause: pause)
        print("MEASURE wrapper playing mp4: real \(Int(real)) ms, seek_time_ms \(Int(seekTime)), played lost \(Int(lost)) ms")
        XCTAssertGreaterThanOrEqual(seekTime, real - 5)
        XCTAssertLessThan(seekTime, real + 150)
        XCTAssertLessThan(abs(lost), 50)
        XCTAssertEqual(h.named("pause").count, 1, "\(h.names)")
    }

    func testSeekWhilePlayingDirectlyOnMp4() throws {
        let h = Harness(mp4Url)
        h.player.play()
        h.waitFor("playing")
        h.wait(2)
        let completion = Completion()
        let started = SystemClock.monotonicMs()
        h.player.seek(to: CMTime(seconds: 30, preferredTimescale: 600), completionHandler: completion.handler)
        let seeked = try XCTUnwrap(h.waitFor("seeked", timeout: 10), "\(h.names)")
        h.wait(1)
        h.player.pause()
        let pause = try XCTUnwrap(h.waitFor("pause", timeout: 2), "\(h.names)")
        h.dispose()
        let seeking = try XCTUnwrap(h.named("seeking").first)
        XCTAssertEqual(h.named("seeking").count, 1, "\(h.names)")
        XCTAssertEqual(h.named("seeked").count, 1, "\(h.names)")
        XCTAssertEqual(seeked.toPositionMs ?? 0, 30000, accuracy: 600)
        let real = try XCTUnwrap(completion.ms) - started
        let seekTime = try XCTUnwrap(seeked.seekTimeMs)
        let lost = playedTimeLost(seeking: seeking, landedMs: 30000, pause: pause)
        print("MEASURE direct playing mp4: real \(Int(real)) ms, seek_time_ms \(Int(seekTime)), played lost \(Int(lost)) ms")
        XCTAssertLessThan(abs(seekTime - real), 150)
        XCTAssertLessThan(abs(lost), 50)
    }

    func testSeekWhilePlayingDirectlyOnHls() throws {
        let h = Harness(imagekitHlsUrl)
        h.player.play()
        h.waitFor("playing")
        h.wait(2.5)
        let from = h.seconds()
        let completion = Completion()
        let started = SystemClock.monotonicMs()
        h.player.seek(to: CMTime(seconds: 20, preferredTimescale: 600), completionHandler: completion.handler)
        let seeked = try XCTUnwrap(h.waitFor("seeked", timeout: 10), "\(h.names)")
        h.wait(1)
        h.dispose()
        let real = try XCTUnwrap(completion.ms) - started
        let seekTime = try XCTUnwrap(seeked.seekTimeMs)
        print("MEASURE direct playing HLS: real \(Int(real)) ms, seek_time_ms \(Int(seekTime))")
        XCTAssertLessThan(abs(seekTime - real), 200)
        XCTAssertEqual(h.named("seeking").count, 1, "\(h.names)")
        XCTAssertEqual(h.named("seeked").count, 1, "\(h.names)")
        XCTAssertEqual(h.named("seeking").first?.fromPositionMs ?? 0, from * 1000, accuracy: 400)
        XCTAssertEqual(seeked.toPositionMs ?? 0, 20000, accuracy: 6000)
        XCTAssertTrue(h.named("pause").isEmpty, "\(h.names)")
        let update = try XCTUnwrap(h.named("timeupdate").first)
        XCTAssertGreaterThan(update.bitrate ?? 0, 0)
        XCTAssertTrue(update.videoCodec?.hasPrefix("avc1.") == true, "\(update.videoCodec ?? "nil")")
    }

    func testSeekWhilePausedDirectAndViaWrapper() throws {
        let h = Harness(mp4Url)
        h.player.play()
        h.waitFor("playing")
        h.wait(1.5)
        h.player.pause()
        h.wait(0.5)
        let directCompletion = Completion()
        var started = SystemClock.monotonicMs()
        h.player.seek(to: CMTime(seconds: 40, preferredTimescale: 600), completionHandler: directCompletion.handler)
        let first = try XCTUnwrap(h.waitFor("seeked", timeout: 5), "\(h.names)")
        let directReal = try XCTUnwrap(directCompletion.ms) - started
        h.wait(0.6)
        let wrapperCompletion = Completion()
        started = SystemClock.monotonicMs()
        h.monitor.seek(to: CMTime(seconds: 60, preferredTimescale: 600), completionHandler: wrapperCompletion.handler)
        let second = try XCTUnwrap(h.waitFor("seeked", count: 2, timeout: 5), "\(h.names)")
        let wrapperReal = try XCTUnwrap(wrapperCompletion.ms) - started
        h.wait(0.6)
        h.player.play()
        h.waitFor("playing", count: 2)
        h.wait(0.5)
        h.dispose()
        assertSubsequence(h.names, ["playing", "pause", "seeking", "seeked", "seeking", "seeked", "play", "playing"])
        XCTAssertEqual(h.named("seeking").count, 2, "\(h.names)")
        XCTAssertEqual(h.named("seeking").first?.fromPositionMs ?? 0, 1500, accuracy: 700)
        XCTAssertEqual(h.named("seeking").last?.fromPositionMs ?? 0, 40000, accuracy: 200)
        XCTAssertEqual(second.toPositionMs ?? 0, 60000, accuracy: 600)
        let directTime = try XCTUnwrap(first.seekTimeMs)
        let wrapperTime = try XCTUnwrap(second.seekTimeMs)
        print("MEASURE paused mp4: direct real \(Int(directReal)) ms, seek_time_ms \(Int(directTime)); "
            + "wrapper real \(Int(wrapperReal)) ms, seek_time_ms \(Int(wrapperTime))")
        XCTAssertLessThan(abs(directTime - directReal), 50)
        XCTAssertEqual(wrapperTime, wrapperReal, accuracy: 10, "a paused wrapper seek finishes at its completion")
    }

    func testBurstOfSeeksIsOneSeek() {
        let h = Harness(mp4Url)
        h.player.play()
        h.waitFor("playing")
        h.wait(2)
        for i in 0..<6 {
            h.player.seek(to: CMTime(seconds: 20 + Double(i) * 2, preferredTimescale: 600))
            h.wait(0.06)
        }
        h.waitFor("seeked", timeout: 10)
        h.wait(1.5)
        h.dispose()
        XCTAssertEqual(h.named("seeked").count, 1, "\(h.names)")
        XCTAssertGreaterThanOrEqual(h.named("seeking").count, 1)
        XCTAssertEqual(h.named("seeked").first?.toPositionMs ?? 0, 30000, accuracy: 600)
    }

    func testSourceChangeEndsTheViewAndOpensANewOne() throws {
        let h = Harness(mp4Url)
        h.player.play()
        h.waitFor("playing")
        h.wait(1)
        let firstView = try XCTUnwrap(h.named("viewinit").first?.playbackId)
        h.player.replaceCurrentItem(with: AVPlayerItem(url: bipbopHlsUrl))
        XCTAssertNotNil(h.waitFor("playing", count: 2), "\(h.names)")
        h.wait(2.5)
        h.dispose()
        assertSubsequence(h.names, ["playing", "viewend", "videochange", "viewinit", "play", "viewstarted", "playing"])
        let viewend = try XCTUnwrap(h.named("viewend").first)
        XCTAssertEqual(viewend.viewEndReason, .videochange)
        XCTAssertEqual(viewend.playbackId, firstView)
        let newView = try XCTUnwrap(h.named("viewinit").last)
        XCTAssertEqual(newView.videoSourceUrl, bipbopHlsUrl.absoluteString)
        XCTAssertEqual(newView.previousPlaybackId, firstView)
        XCTAssertTrue(h.named("seeking").isEmpty, "\(h.names)")
        let update = try XCTUnwrap(h.named("timeupdate").last)
        XCTAssertEqual(update.playbackId, newView.playbackId)
        XCTAssertGreaterThan(update.bitrate ?? 0, 0)
    }

    func testNotFoundIsAFatalError() throws {
        let h = Harness(missingMp4Url)
        h.player.play()
        let error = try XCTUnwrap(h.waitFor("error", timeout: 20), "\(h.names)")
        h.wait(0.3)
        h.dispose()
        XCTAssertEqual(error.errorCode, "NSURLErrorDomain:-1100")
        XCTAssertTrue(error.errorContext?.contains(#""source":"item_status_failed""#) == true, error.errorContext ?? "nil")
        assertSubsequence(h.names, ["viewinit", "play", "error", "viewend"])
        XCTAssertEqual(h.named("viewend").first?.viewEndReason, .error)
        XCTAssertEqual(h.named("error").count, 1)
    }

    func testEndOfVideoThenLoop() throws {
        let h = Harness(mp4Url)
        h.waitReady()
        let duration = try XCTUnwrap(h.player.currentItem?.duration.seconds)
        h.monitor.seek(to: CMTime(seconds: duration - 1.5, preferredTimescale: 600))
        h.waitFor("seeked", timeout: 5)
        h.player.play()
        XCTAssertNotNil(h.waitFor("ended", timeout: 10), "\(h.names)")
        h.wait(0.5)
        h.player.seek(to: .zero)
        h.player.play()
        XCTAssertNotNil(h.waitFor("playing", count: 2, timeout: 10), "\(h.names)")
        h.wait(0.5)
        h.dispose()
        assertSubsequence(h.names, ["seeking", "seeked", "play", "playing", "ended", "seeking", "seeked", "play", "playing"])
        XCTAssertEqual(h.named("ended").count, 1, "\(h.names)")
        XCTAssertEqual(h.named("seeking").last?.fromPositionMs ?? 0, duration * 1000, accuracy: 100)
        XCTAssertEqual(h.named("seeked").last?.toPositionMs ?? 0, 0, accuracy: 300)
        XCTAssertEqual(h.named("viewinit").count, 1)
    }

    func testRate2x() throws {
        let h = Harness(mp4Url)
        h.player.play()
        h.waitFor("playing")
        h.wait(1)
        h.player.rate = 2
        h.wait(3)
        h.player.pause()
        let pause = try XCTUnwrap(h.waitFor("pause", timeout: 2))
        h.dispose()
        XCTAssertTrue(h.named("seeking").isEmpty, "\(h.names)")
        XCTAssertEqual(h.named("play").count, 1, "\(h.names)")
        let playhead = try XCTUnwrap(pause.playbackTimeInstantMs)
        XCTAssertGreaterThan(playhead, 6000)
        XCTAssertEqual(pause.playingTimeMs ?? 0, playhead, accuracy: 600)
    }

    func testPlayerLayerSurface() throws {
        let layer = AVPlayerLayer()
        layer.frame = CGRect(x: 0, y: 0, width: 320, height: 180)
        let h = Harness(nil, surface: .layer(layer))
        layer.player = h.player
        h.player.replaceCurrentItem(with: AVPlayerItem(url: imagekitHlsUrl))
        h.player.play()
        h.waitFor("playing")
        h.wait(2.5)
        h.dispose()
        assertSubsequence(h.names, ["playerready", "viewinit", "play", "viewstarted", "playing", "timeupdate"])
        let context = try XCTUnwrap(h.transport.requests.last?.c)
        XCTAssertEqual((context["pw"] as? NSNumber)?.doubleValue, 320)
        XCTAssertEqual((context["ph"] as? NSNumber)?.doubleValue, 180)
        XCTAssertEqual(h.named("viewinit").first?.videoSourceUrl, imagekitHlsUrl.absoluteString)
    }

    /// Backgrounding ships what is queued; while backgrounded, a pause ships at once.
    func testBackgroundFlushes() throws {
        var begun = 0
        var ended: [UIBackgroundTaskIdentifier] = []
        let tasks = BackgroundTasks(
            begin: { _ in
                begun += 1
                return UIBackgroundTaskIdentifier(rawValue: begun)
            },
            end: { ended.append($0) }
        )
        let h = Harness(mp4Url, backgroundTasks: tasks)
        h.player.play()
        h.waitFor("playing")
        h.wait(1)
        XCTAssertTrue(h.transport.requests.isEmpty)
        NotificationCenter.default.post(name: UIApplication.didEnterBackgroundNotification, object: nil)
        XCTAssertEqual(h.transport.requests.map(\.r), ["visibility_hidden"])
        XCTAssertEqual(h.transport.rowEventNames.last, "timeupdate")
        h.wait(0.5)
        h.player.pause()
        h.waitUntil(2) { h.transport.requests.count == 2 }
        XCTAssertEqual(h.transport.requests.map(\.r), ["visibility_hidden", "visibility_hidden"])
        XCTAssertEqual(h.transport.requests.last?.e.count, 2, "timeupdate + pause")
        NotificationCenter.default.post(name: UIApplication.willEnterForegroundNotification, object: nil)
        h.wait(0.3)
        h.player.play()
        h.waitFor("playing", count: 2)
        h.player.pause()
        h.wait(0.2)
        XCTAssertEqual(h.transport.requests.count, 2, "in the foreground a pause waits for the interval")
        XCTAssertEqual(begun, 2)
        XCTAssertEqual(ended.map(\.rawValue), [1, 2], "each task ends once its send has completed")
        h.dispose()
    }

    /// The app drops the monitor at once: tracking goes on with the player and ends when it is released.
    func testTheMonitorLivesWithThePlayer() {
        let transport = CapturingTransport()
        weak var weakPlayer: AVPlayer?
        autoreleasepool {
            let player = AVPlayer(url: mp4Url)
            player.isMuted = true
            weakPlayer = player
            _ = ImageKitVideoAnalytics.monitor(
                player: player,
                surface: .size(CGSize(width: 100, height: 100)),
                imagekitId: "ios-sdk-test",
                config: ImageKitVideoAnalytics.Config(),
                platform: IOSPlatform(transport: transport)
            )
            player.play()
            RunLoop.main.run(until: Date().addingTimeInterval(3))
            player.pause()
        }
        RunLoop.main.run(until: Date().addingTimeInterval(0.5))
        XCTAssertNil(weakPlayer)
        assertSubsequence(transport.rowEventNames, ["viewinit", "play", "viewstarted", "playing", "pause", "viewend"])
        XCTAssertEqual(transport.rowEventNames.last, "viewend")
    }
}
#endif
