/// Allowance over the playback rate for tick jitter and playheads that update in steps.
private let rateTolerance = 1.5

/// Counts content played (`playing_time_ms`): how far the playhead moved between ticks while
/// counting. A move faster than the playback rate allows is a jump, not watching, and is skipped.
/// No player or platform access: callers feed it playheads and monotonic times, in ms.
package struct PlayedTimeCounter {
    package var total: Double = 0
    /// Latest known playhead.
    package var position: Double = 0
    private var reported: Double = 0
    private var counting = false
    private var lastMoveAt: Double = 0
    private var rate: Double = 1
    private let maxEstimateMs: Double

    package init(maxEstimateMs: Double) {
        self.maxEstimateMs = maxEstimateMs
    }

    package var isCounting: Bool {
        counting
    }

    package mutating func start(_ playheadMs: Double, _ now: Double, _ rate: Double) {
        if counting { return }
        counting = true
        position = playheadMs
        lastMoveAt = now
        self.rate = rate
    }

    package mutating func tick(_ playheadMs: Double, _ now: Double, _ rate: Double) {
        if !counting { return }
        let moved = playheadMs - position
        // Unchanged: wait for the playhead to move, so a stepped playhead is judged over its whole step.
        if moved == 0 { return }
        let maxMove = (now - lastMoveAt) * Swift.max(rate, self.rate) * rateTolerance
        if moved > 0 && moved <= maxMove { total += moved }
        position = playheadMs
        lastMoveAt = now
        self.rate = rate
    }

    package mutating func stop(_ playheadMs: Double, _ now: Double, _ rate: Double) {
        tick(playheadMs, now, rate)
        counting = false
    }

    /// Stops counting at a seek and returns the position it left from. With `fromMs` (known to the
    /// player), counting stops there. Otherwise the player already reports the target, so the time
    /// played since the playhead last moved is estimated at the last rate; a playhead that has not
    /// moved for longer than `maxEstimateMs` was not playing, so nothing is added.
    package mutating func seek(_ now: Double, _ fromMs: Double? = nil) -> Double {
        if let fromMs {
            if counting { stop(fromMs, now, rate) } else { position = fromMs }
        } else if counting {
            let sinceMove = now - lastMoveAt
            let played = sinceMove <= maxEstimateMs ? jsRound(sinceMove * rate) : 0
            total += played
            position += played
            counting = false
        }
        return position
    }

    /// Time counted since the last call: the `played_delta_ms` of the next row.
    package mutating func takeUnreported() -> Double {
        let delta = total - reported
        reported = total
        return delta
    }

    package var hasUnreported: Bool {
        total > reported
    }

    package mutating func resetTotal() {
        total = 0
        reported = 0
    }
}
