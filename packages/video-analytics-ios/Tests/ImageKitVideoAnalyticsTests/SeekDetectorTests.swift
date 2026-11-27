// Synthetic readings modelled on the seek spike logs (iOS 26.5 simulator): periodic ticks every
// 100 ms while the clock runs, the extra tick mp4 sends right after `seek()` with the old time,
// frozen ticks at the target, `timeJumped` / rate changes as `observe` readings.
import XCTest
@testable import ImageKitVideoAnalytics

private struct Driver {
    var detector = SeekDetector()
    var log: [(ms: Double, output: SeekDetector.Output)] = []
    var now = 0.0

    init(position: Double = 0, rate: Double = 0) {
        detector.reset(position: position, rate: rate, nowMs: 0)
    }

    private mutating func record(_ outputs: [SeekDetector.Output]) {
        log += outputs.map { (now, $0) }
    }

    mutating func tick(_ ms: Double, _ time: Double, ct: Double? = nil, rate: Double = 1) {
        now = ms
        record(detector.tick(time: time, currentTime: ct ?? time, rate: rate, nowMs: ms))
    }

    mutating func probe(_ ms: Double, ct: Double, rate: Double = 1) {
        now = ms
        record(detector.probe(currentTime: ct, rate: rate, nowMs: ms))
    }

    mutating func observe(_ ms: Double, ct: Double, rate: Double) {
        now = ms
        record(detector.observe(currentTime: ct, rate: rate, nowMs: ms))
    }

    /// Ticks every 100 ms from `ms` while playing from `position`; returns the last tick's position.
    @discardableResult
    mutating func play(from position: Double, at ms: Double, until endMs: Double, rate: Double = 1) -> Double {
        var t = ms
        var p = position
        while t <= endMs {
            tick(t, p, rate: rate)
            t += 100
            p += 0.1 * rate
        }
        return p - 0.1 * rate
    }

    mutating func ended(_ ms: Double, at position: Double) {
        now = ms
        record(detector.didPlayToEnd(position: position, nowMs: ms))
    }

    var seekingFroms: [Double] {
        log.compactMap { if case .seeking(let from) = $0.output { return from } else { return nil } }
    }

    var seekedTimes: [Double] {
        log.compactMap { $0.output == .seeked ? $0.ms : nil }
    }
}

final class SeekDetectorTests: XCTestCase {
    private func assertClose(_ a: Double?, _ b: Double, accuracy: Double = 0.011, file: StaticString = #filePath, line: UInt = #line) {
        guard let a else { return XCTFail("nil", file: file, line: line) }
        XCTAssertEqual(a, b, accuracy: accuracy, file: file, line: line)
    }

    // c05 mp4: seek +4 s inside the buffer while playing.
    func testBufferedMp4SeekWhilePlaying() {
        var d = Driver()
        d.observe(1000, ct: 0, rate: 1)
        let from = d.play(from: 0.1, at: 1100, until: 2400)
        d.tick(2424, from + 0.02, ct: 5.4) // the old-time tick right after seek()
        d.tick(2456, 5.4)
        d.tick(2475, 5.4)
        d.tick(2476, 5.4)
        d.play(from: 5.47, at: 2614, until: 4000)
        XCTAssertEqual(d.seekingFroms.count, 1)
        assertClose(d.seekingFroms.first, from)
        XCTAssertEqual(d.seekedTimes, [2614], "the first tick running at the target")
    }

    // c05 mp4 again, with the adapter's probes: `seeked` when the clock starts running, not a tick later.
    func testProbesFinishAPlayingSeekWhenTheClockRuns() {
        var d = Driver()
        d.observe(1000, ct: 0, rate: 1)
        let from = d.play(from: 0.1, at: 1100, until: 2400)
        d.tick(2424, from + 0.02, ct: 5.4)
        XCTAssertFalse(d.detector.awaitsRunningClock, "not landed while the tick is on the old timeline")
        d.tick(2456, 5.4)
        XCTAssertTrue(d.detector.awaitsRunningClock)
        d.probe(2476, ct: 5.4)
        d.probe(2496, ct: 5.4)
        XCTAssertTrue(d.seekedTimes.isEmpty, "frozen at the target")
        d.probe(2516, ct: 5.415)
        XCTAssertEqual(d.seekedTimes, [2516])
        XCTAssertFalse(d.detector.awaitsRunningClock)
        d.play(from: 5.47, at: 2614, until: 4000)
        XCTAssertEqual(d.seekingFroms.count, 1)
        XCTAssertEqual(d.seekedTimes.count, 1)
    }

    func testNoProbesWhilePaused() {
        var d = Driver(position: 10)
        d.tick(1000, 50, rate: 0)
        XCTAssertFalse(d.detector.awaitsRunningClock)
        d.probe(1020, ct: 70, rate: 0)
        XCTAssertEqual(d.seekedTimes, [1000])
        XCTAssertEqual(d.seekingFroms.count, 1, "a probe outside a landed playing seek reads nothing")
    }

    // c15: mp4 seek outside the buffer while playing; ticks stay on the old timeline for ~3 s.
    func testUnbufferedMp4SeekWhilePlaying() {
        var d = Driver()
        d.observe(1000, ct: 0, rate: 1)
        let from = d.play(from: 0.1, at: 1100, until: 4400)
        var t = 4440.0
        var old = from + 0.04
        while t < 7600 {
            d.tick(t, old, ct: 100)
            t += 100
            old += 0.1
        }
        XCTAssertEqual(d.seekingFroms.count, 1, "one seeking, at the first disagreeing tick")
        XCTAssertTrue(d.seekedTimes.isEmpty)
        d.tick(7606, 100)
        d.tick(7626, 100)
        d.tick(7627, 100)
        d.play(from: 100.1, at: 7797, until: 9000)
        assertClose(d.seekingFroms.first, from)
        XCTAssertEqual(d.seekedTimes, [7797])
    }

    // c05 hls #2: seek back 3 s; HLS sends no old-time tick, the first tick is at the target.
    func testHlsSeekWhilePlaying() {
        var d = Driver()
        d.observe(1000, ct: 0, rate: 1)
        let from = d.play(from: 0.1, at: 1100, until: 9800)
        d.tick(9886, from - 3)
        d.tick(9897, from - 3)
        d.tick(9898, from - 3)
        d.play(from: from - 2.987, at: 9961, until: 11000)
        XCTAssertEqual(d.seekingFroms.count, 1)
        assertClose(d.seekingFroms.first, from)
        XCTAssertEqual(d.seekedTimes, [9961])
    }

    // c08: paused seeks finish at the jump.
    func testPausedSeek() {
        var d = Driver()
        d.observe(1000, ct: 0, rate: 1)
        let paused = d.play(from: 0.1, at: 1100, until: 5000)
        d.observe(5050, ct: paused + 0.05, rate: 0)
        d.tick(6000, paused + 3.05, rate: 0)
        d.observe(6001, ct: paused + 3.05, rate: 0) // timeJumped
        XCTAssertEqual(d.seekingFroms.count, 1)
        assertClose(d.seekingFroms.first, paused + 0.05)
        XCTAssertEqual(d.seekedTimes, [6000])
    }

    // c12: 8 seeks 52 ms apart while playing; each cancels the last. One seek, timed from the last jump.
    func testBurstWhilePlaying() {
        var d = Driver()
        d.observe(1000, ct: 0, rate: 1)
        let from = d.play(from: 0.1, at: 1100, until: 3100)
        d.tick(3178, from + 0.04, ct: 20)
        for i in 0..<8 { d.tick(3213 + Double(i) * 52, 20 + Double(i) * 2) }
        d.tick(3605, 34)
        d.tick(3606, 34)
        d.play(from: 34.1, at: 3776, until: 5000)
        XCTAssertEqual(d.seekingFroms.count, 8)
        XCTAssertTrue(d.seekingFroms.allSatisfy { abs($0 - from) < 0.011 })
        XCTAssertEqual(d.seekedTimes, [3776])
    }

    // c13: 8 seeks 52 ms apart while paused. Each finishes at its jump before the next, so each is
    // a seek from where the last one landed, as a browser reports it.
    func testBurstWhilePausedIsASeekPerJump() {
        var d = Driver(position: 2.9)
        let times = (0..<8).map { 4332 + Double($0) * 52 }
        for (i, ms) in times.enumerated() { d.tick(ms, 20 + Double(i) * 2, rate: 0) }
        XCTAssertEqual(d.seekedTimes, times)
        XCTAssertEqual(d.seekingFroms, [2.9] + (0..<7).map { 20 + Double($0) * 2 })
    }

    // c21/c22: AVPlayerViewController scrub — rate 0, a jump every ~22 ms, rate 1 on release.
    func testScrubWhilePausedIsASeekPerPosition() {
        var d = Driver()
        d.observe(1000, ct: 0, rate: 1)
        let from = d.play(from: 0.1, at: 1100, until: 5000)
        d.observe(5040, ct: from + 0.04, rate: 0)
        let times = (0..<30).map { 5400 + Double($0) * 22 }
        for (i, ms) in times.enumerated() { d.tick(ms, from + 1 + Double(i) * 1.5, rate: 0) }
        let release = times.last!
        d.observe(release + 100, ct: from + 1 + 29 * 1.5, rate: 1)
        d.play(from: from + 1 + 29 * 1.5 + 0.05, at: release + 300, until: release + 2000)
        XCTAssertEqual(d.seekedTimes, times)
        XCTAssertEqual(d.seekingFroms.count, 30)
        assertClose(d.seekingFroms.first, from + 0.04)
        assertClose(d.seekingFroms.last, from + 1 + 28 * 1.5)
    }

    func testNoFalsePositivesFromPlayRateStallAndJitter() {
        var d = Driver()
        // play: frozen for 150 ms (mp4 posts timeJumped with no movement), then running
        d.observe(1000, ct: 0, rate: 1)
        d.observe(1050, ct: 0, rate: 1)
        var p = d.play(from: 0.008, at: 1190, until: 3000)
        // 2x, then 0.5x
        d.observe(3050, ct: p + 0.05, rate: 2)
        p = d.play(from: p + 0.25, at: 3150, until: 5000, rate: 2)
        d.observe(5050, ct: p + 0.1, rate: 0.5)
        p = d.play(from: p + 0.125, at: 5150, until: 7000, rate: 0.5)
        // pause 3 s, resume where it stopped
        d.observe(7050, ct: p + 0.025, rate: 0)
        d.observe(10050, ct: p + 0.025, rate: 1)
        d.observe(10051, ct: p + 0.025, rate: 1)
        p = d.play(from: p + 0.05, at: 10200, until: 12000)
        // stall for 7 s with rate 1 (status waiting), then resume
        d.observe(12020, ct: p + 0.02, rate: 1)
        d.observe(19000, ct: p + 0.025, rate: 1)
        p = d.play(from: p + 0.05, at: 19100, until: 20000)
        // a 1 s main-thread hiccup between ticks
        d.tick(21000, p + 1.0)
        // tick jitter and a tiny corrective jump
        d.tick(21105, p + 1.1)
        d.tick(21190, p + 1.03)
        d.tick(21300, p + 1.3)
        XCTAssertTrue(d.log.isEmpty, "\(d.log)")
    }

    // c04: replaceCurrentItem; the new item starts over at 0.
    func testItemChangeStartsOver() {
        var d = Driver()
        d.observe(1000, ct: 0, rate: 1)
        d.play(from: 0.1, at: 1100, until: 50000)
        d.detector.reset(position: 0, rate: 1, nowMs: 50050)
        d.observe(50051, ct: 0, rate: 1) // timeJumped on replace
        d.play(from: 0.01, at: 51000, until: 53000)
        XCTAssertTrue(d.log.isEmpty, "\(d.log)")
    }

    // c11 mp4: rate→0, DidPlayToEnd, the app seeks to 0 and plays: ended → seeking(from: end) → seeked.
    func testLoopIsASeekFromTheEnd() {
        var d = Driver(position: 155, rate: 1)
        d.play(from: 155.1, at: 100, until: 2900)
        d.tick(2903, 158) // end-of-item time jump
        d.observe(2904, ct: 158, rate: 1)
        d.observe(2935, ct: 158, rate: 0)
        d.ended(2936, at: 158)
        d.observe(2938, ct: 0, rate: 1)
        XCTAssertEqual(d.seekingFroms, [158])
        d.tick(2942, 0)
        d.tick(2953, 0)
        d.play(from: 0.108, at: 3132, until: 4000)
        XCTAssertEqual(d.seekedTimes, [3132])
        XCTAssertEqual(d.seekingFroms, [158])
    }

    func testEndOfItemNoiseIsNotASeek() {
        var d = Driver(position: 155, rate: 1)
        d.play(from: 155.1, at: 100, until: 2900)
        d.observe(2902, ct: 158, rate: 0)
        d.ended(2903, at: 158)
        d.observe(2904, ct: 158.0, rate: 0) // HLS rate→0 after the end
        XCTAssertTrue(d.log.isEmpty, "\(d.log)")
    }

    // c10: seek back to 0 after the end while paused.
    func testSeekAfterEndWhilePaused() {
        var d = Driver(position: 155, rate: 1)
        d.play(from: 155.1, at: 100, until: 2900)
        d.observe(2902, ct: 158, rate: 0)
        d.ended(2903, at: 158)
        d.tick(4400, 0, rate: 0)
        XCTAssertEqual(d.seekingFroms, [158])
        XCTAssertEqual(d.seekedTimes, [4400])
    }

    func testPauseWhileSeekIsFrozenSettlesIt() {
        var d = Driver()
        d.observe(1000, ct: 0, rate: 1)
        let from = d.play(from: 0.1, at: 1100, until: 3000)
        d.tick(3010, from + 0.01, ct: 80)
        d.tick(3050, 80)
        d.observe(4000, ct: 80, rate: 0)
        XCTAssertEqual(d.seekingFroms.count, 1)
        XCTAssertEqual(d.seekedTimes, [4000])
    }

    func testSmallCorrectiveJumpAfterSeekedIsIgnored() {
        var d = Driver(position: 10)
        d.tick(1000, 50, rate: 0)
        XCTAssertEqual(d.seekedTimes, [1000])
        d.tick(2100, 49.86, rate: 0)
        d.observe(2101, ct: 49.86, rate: 0)
        XCTAssertEqual(d.seekingFroms.count, 1)
        XCTAssertEqual(d.seekedTimes.count, 1)
    }
}
