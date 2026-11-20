/** Allowance over the playback rate for tick jitter and playheads that update in steps. */
const RATE_TOLERANCE = 1.5;

/**
 * Counts content played (`playing_time_ms`): how far the playhead moved between ticks while
 * counting. A move faster than the playback rate allows is a jump, not watching, and is skipped.
 * No player or platform access: callers feed it playheads and monotonic times, in ms.
 */
export class PlayedTimeCounter {
  total = 0;
  /** Latest known playhead. */
  position = 0;
  private reported = 0;
  private counting = false;
  private lastMoveAt = 0;
  private rate = 1;

  constructor(private readonly maxEstimateMs: number) {}

  get isCounting(): boolean {
    return this.counting;
  }

  start(playheadMs: number, now: number, rate: number): void {
    if (this.counting) return;
    this.counting = true;
    this.position = playheadMs;
    this.lastMoveAt = now;
    this.rate = rate;
  }

  tick(playheadMs: number, now: number, rate: number): void {
    if (!this.counting) return;
    const moved = playheadMs - this.position;
    // Unchanged: wait for the playhead to move, so a stepped playhead is judged over its whole step.
    if (moved === 0) return;
    const maxMove = (now - this.lastMoveAt) * Math.max(rate, this.rate) * RATE_TOLERANCE;
    if (moved > 0 && moved <= maxMove) this.total += moved;
    this.position = playheadMs;
    this.lastMoveAt = now;
    this.rate = rate;
  }

  stop(playheadMs: number, now: number, rate: number): void {
    this.tick(playheadMs, now, rate);
    this.counting = false;
  }

  /**
   * Stops counting at a seek. The player already reports the target, so the time played since the
   * playhead last moved is estimated at the last rate. A playhead that has not moved for longer than
   * `maxEstimateMs` was not playing, so nothing is added. Returns the position the seek left from.
   */
  seek(now: number): number {
    if (this.counting) {
      const sinceMove = now - this.lastMoveAt;
      const played = sinceMove <= this.maxEstimateMs ? Math.round(sinceMove * this.rate) : 0;
      this.total += played;
      this.position += played;
      this.counting = false;
    }
    return this.position;
  }

  /** Time counted since the last call: the `played_delta_ms` of the next row. */
  takeUnreported(): number {
    const delta = this.total - this.reported;
    this.reported = this.total;
    return delta;
  }

  get hasUnreported(): boolean {
    return this.total > this.reported;
  }

  resetTotal(): void {
    this.total = 0;
    this.reported = 0;
  }
}
