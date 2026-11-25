// AVPlayer has no seek events: a seek is inferred from playhead readings (seek spike, iOS 26.5).
//  - `seeking`: a 100 ms tick whose time disagrees with `currentTime()` (a seek in flight: mp4 keeps
//    ticking on the old timeline for seconds while `currentTime()` is the target), or a reading that
//    moved more than the tolerance both from the last reading and from where the rate projects it.
//    `timeJumped` and rate / status changes are only extra readings: mp4 posts `timeJumped` on play,
//    rate changes and end with no movement. The jump is seen late, so `seeking` carries where
//    playback left from: the last tick that agreed with `currentTime()`.
//  - `seeked`: playing → the first tick where the clock runs at the new position (mp4 reports
//    `.playing` while frozen for up to seconds); paused → at the jump. It is sent at that reading,
//    since the tracker times the seek and resumes counting when it receives it. The periodic tick
//    after landing comes only after 100 ms of playback, so from landing until the clock runs the
//    adapter probes `currentTime()` every `runningProbeMs`. A jump before the seek finished is the
//    same seek (a burst while playing); one after it is a new seek, as on web, where a scrub over
//    buffered media fires `seeking` / `seeked` for each position.
//  - The `seek(to:)` wrapper sends `seeking` itself, with the exact position, and suppresses
//    detection until its latest seek completes with `finished == true`.
//  - After the end of the item, the first reading away from the end is a seek from the end (a loop
//    is `ended → seeking → seeked`). An item change starts over.
// Positions are in seconds, wall times in monotonic ms.
struct SeekDetector {
    enum Output: Equatable {
        case seeking(from: Double)
        case seeked
    }

    static let jumpTolerance = 0.5
    static let wrapperTimeoutMs = 10_000.0
    static let runningProbeMs = 20.0
    /// Allowance over the rate for a tick that counts as running, for jitter between ticks.
    private static let runningRateTolerance = 1.5
    private static let runningSlack = 0.05

    private struct Reading {
        var position: Double
        var wallMs: Double
        var rate: Double
    }

    private var anchor: Reading?
    private var lastAgreeingPosition: Double?
    private(set) var isSeeking = false
    private var seekFrom = 0.0
    private var target = 0.0
    /// Playing, at the target and agreeing with `currentTime()`: the seek finishes once the clock runs.
    private var landed = false
    private var endedPosition: Double?
    private(set) var wrapperGeneration = 0
    private var wrapperInFlight = false
    private var wrapperStartedMs = 0.0

    /// Whether the adapter should `probe` every `runningProbeMs`.
    var awaitsRunningClock: Bool {
        isSeeking && landed && !wrapperInFlight
    }

    /// New item: forget everything; readings start from `position`.
    mutating func reset(position: Double?, rate: Double, nowMs: Double) {
        let generation = wrapperGeneration
        self = SeekDetector()
        wrapperGeneration = generation + 1
        if let position {
            anchor = Reading(position: position, wallMs: nowMs, rate: rate)
            lastAgreeingPosition = position
        }
    }

    private func projected(_ a: Reading, _ nowMs: Double) -> Double {
        a.position + (nowMs - a.wallMs) / 1000 * a.rate
    }

    private func isJump(_ position: Double, _ nowMs: Double) -> Bool {
        guard let a = anchor else { return false }
        return abs(position - a.position) > Self.jumpTolerance
            && abs(position - projected(a, nowMs)) > Self.jumpTolerance
    }

    private func isRunning(from previous: Reading, to position: Double, _ nowMs: Double, _ rate: Double) -> Bool {
        let moved = position - previous.position
        let elapsed = (nowMs - previous.wallMs) / 1000
        let maxMove = elapsed * Swift.max(rate, previous.rate) * Self.runningRateTolerance + Self.runningSlack
        return moved > 0.001 && moved <= maxMove
    }

    private mutating func beginSeek(from: Double, to: Double) -> [Output] {
        if !isSeeking {
            isSeeking = true
            seekFrom = from
        }
        target = to
        landed = false
        return [.seeking(from: seekFrom)]
    }

    private mutating func finishSeek() -> [Output] {
        isSeeking = false
        landed = false
        lastAgreeingPosition = anchor?.position ?? target
        return [.seeked]
    }

    private mutating func expireWrapper(_ nowMs: Double) {
        if wrapperInFlight, nowMs - wrapperStartedMs >= Self.wrapperTimeoutMs { wrapperInFlight = false }
    }

    /// A reading away from the end of the item opens a seek from the end.
    private mutating func leaveEnd(_ currentTime: Double) -> [Output]? {
        guard let ended = endedPosition else { return nil }
        guard abs(currentTime - ended) > Self.jumpTolerance else { return [] }
        endedPosition = nil
        return beginSeek(from: ended, to: currentTime)
    }

    /// Periodic time observer: `time` is the observer's, `currentTime` the player's `currentTime()`.
    mutating func tick(time: Double, currentTime: Double, rate: Double, nowMs: Double) -> [Output] {
        expireWrapper(nowMs)
        let agrees = abs(currentTime - time) <= Self.jumpTolerance
        let previous = anchor
        var out: [Output] = []
        if let fromEnd = leaveEnd(currentTime) {
            out += fromEnd
        } else if wrapperInFlight {
            if !agrees || isJump(time, nowMs) { target = currentTime }
        } else if !isSeeking {
            if !agrees {
                out += beginSeek(from: lastAgreeingPosition ?? time, to: currentTime)
            } else if isJump(time, nowMs) {
                out += beginSeek(from: lastAgreeingPosition ?? previous?.position ?? time, to: time)
            } else {
                lastAgreeingPosition = time
            }
        } else if !agrees || isJump(time, nowMs), abs(currentTime - target) > Self.jumpTolerance {
            out += beginSeek(from: seekFrom, to: currentTime)
        }

        anchor = Reading(position: time, wallMs: nowMs, rate: rate)

        if isSeeking, !wrapperInFlight, agrees, abs(time - target) <= Self.jumpTolerance * 2 {
            if rate == 0 {
                out += finishSeek()
            } else if let previous, isRunning(from: previous, to: time, nowMs, rate) {
                out += finishSeek()
            } else {
                landed = true
            }
        }
        return out
    }

    /// A `currentTime()` reading while `awaitsRunningClock`.
    mutating func probe(currentTime: Double, rate: Double, nowMs: Double) -> [Output] {
        guard awaitsRunningClock else { return [] }
        return tick(time: currentTime, currentTime: currentTime, rate: rate, nowMs: nowMs)
    }

    /// A reading outside the periodic observer: rate or status change, `timeJumped`.
    mutating func observe(currentTime: Double, rate: Double, nowMs: Double) -> [Output] {
        expireWrapper(nowMs)
        var out: [Output] = []
        if let fromEnd = leaveEnd(currentTime) {
            out += fromEnd
        } else if wrapperInFlight {
            if abs(currentTime - target) > Self.jumpTolerance, isJump(currentTime, nowMs) { target = currentTime }
        } else if !isSeeking {
            if isJump(currentTime, nowMs) {
                out += beginSeek(from: lastAgreeingPosition ?? anchor?.position ?? currentTime, to: currentTime)
            } else if anchor != nil {
                lastAgreeingPosition = currentTime
            }
        } else if abs(currentTime - target) > Self.jumpTolerance, isJump(currentTime, nowMs) {
            out += beginSeek(from: seekFrom, to: currentTime)
        }

        if let a = anchor, a.rate != rate {
            anchor = Reading(position: currentTime, wallMs: nowMs, rate: rate)
        }
        // Paused while the seek is still in flight: it finishes where it is, as a paused seek does.
        if isSeeking, !wrapperInFlight, rate == 0, abs(currentTime - target) <= Self.jumpTolerance {
            out += finishSeek()
        }
        return out
    }

    /// The `seek(to:)` wrapper is about to call `player.seek`, from `currentTime`. Returns the generation
    /// its completion must present.
    mutating func wrapperBegan(currentTime: Double, nowMs: Double) -> (generation: Int, outputs: [Output]) {
        wrapperGeneration += 1
        wrapperInFlight = true
        wrapperStartedMs = nowMs
        let from = endedPosition ?? currentTime
        endedPosition = nil
        return (wrapperGeneration, beginSeek(from: from, to: currentTime))
    }

    /// A wrapper seek's completion. Only the latest seek counts; a cancelled one hands over to detection.
    mutating func wrapperCompleted(
        generation: Int,
        finished: Bool,
        currentTime: Double,
        rate: Double,
        nowMs: Double
    ) -> [Output] {
        guard generation == wrapperGeneration, wrapperInFlight else { return [] }
        wrapperInFlight = false
        guard finished else { return [] }
        target = currentTime
        anchor = Reading(position: currentTime, wallMs: nowMs, rate: rate)
        if rate == 0 { return finishSeek() }
        landed = true
        return []
    }

    /// The item played to its end at `position` (its duration when known).
    mutating func didPlayToEnd(position: Double, nowMs: Double) -> [Output] {
        let out = isSeeking ? finishSeek() : []
        wrapperInFlight = false
        endedPosition = position
        anchor = Reading(position: position, wallMs: nowMs, rate: 0)
        return out
    }
}
