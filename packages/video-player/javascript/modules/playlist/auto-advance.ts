import type Player from 'video.js/dist/types/player';

/**
 * Calls advanceCallback when `ended` fires, after a delay.
 * Delay = false  → no auto-advance
 * Delay = 0      → immediate
 * Delay > 0      → seconds to wait
 */
export class AutoAdvance {
  private player_: Player;
  private advanceCallback_: () => void;
  private delay_: number | null = null;
  private timeoutId_: number | null = null;

  constructor(player: Player, advanceCallback: () => void) {
    this.player_ = player;
    this.advanceCallback_ = advanceCallback;
  }

  setDelay(seconds: number | false): void {
    this.fullReset();

    if (seconds === false) {
      // no auto-advance
      return;
    }

    if (typeof seconds !== 'number' || seconds < 0 || !isFinite(seconds)) {
      return;
    }

    this.delay_ = seconds;
    this.player_.on('ended', this.startTimeout_);
  }

  getDelay(): number | null {
    return this.delay_;
  }

  private startTimeout_ = (): void => {
    this.clearTimeout_();
    if (this.delay_ == null) { return; }

    // if user manually restarts, cancel
    this.player_.one('play', this.clearTimeout_);

    this.timeoutId_ = window.setTimeout(() => {
      this.advanceCallback_();
      this.clearTimeout_();
    }, this.delay_ * 1000);
  };

  private clearTimeout_ = (): void => {
    if (this.timeoutId_ != null) {
      clearTimeout(this.timeoutId_);
      this.timeoutId_ = null;
      this.player_.off('play', this.clearTimeout_);
    }
  };

  fullReset(): void {
    this.clearTimeout_();
    this.player_.off('ended', this.startTimeout_);
    this.delay_ = null;
  }
}