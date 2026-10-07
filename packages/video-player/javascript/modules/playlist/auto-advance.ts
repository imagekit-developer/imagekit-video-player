import type Player from 'video.js/dist/types/player';

/**
 * Optional hooks so the UI can show, announce and cancel the countdown
 * (WCAG 2.2.1 Timing Adjustable, 4.1.3 Status Messages).
 */
export interface AutoAdvanceCountdownHooks {
  /** Countdown started; `seconds` until the next item loads. */
  onStart?: (seconds: number) => void;
  /** Called once per second with the whole seconds remaining. */
  onTick?: (secondsLeft: number) => void;
  /** Countdown ended: advanced, cancelled or reset. */
  onStop?: () => void;
}

/**
 * Calls advanceCallback when `ended` fires, after a delay.
 * Delay = false  → no auto-advance
 * Delay = 0      → immediate
 * Delay > 0      → seconds to wait
 */
export class AutoAdvance {
  private player_: Player;
  private advanceCallback_: () => void;
  private hooks_: AutoAdvanceCountdownHooks;
  private delay_: number | null = null;
  private timeoutId_: number | null = null;
  private intervalId_: number | null = null;

  constructor(player: Player, advanceCallback: () => void, hooks: AutoAdvanceCountdownHooks = {}) {
    this.player_ = player;
    this.advanceCallback_ = advanceCallback;
    this.hooks_ = hooks;
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
      this.clearTimeout_();
      this.advanceCallback_();
    }, this.delay_ * 1000);

    if (this.delay_ > 0) {
      let secondsLeft = Math.ceil(this.delay_);
      this.hooks_.onStart?.(secondsLeft);
      this.intervalId_ = window.setInterval(() => {
        secondsLeft = Math.max(secondsLeft - 1, 0);
        this.hooks_.onTick?.(secondsLeft);
      }, 1000);
    }
  };

  private clearTimeout_ = (): void => {
    if (this.intervalId_ != null) {
      clearInterval(this.intervalId_);
      this.intervalId_ = null;
    }
    if (this.timeoutId_ != null) {
      clearTimeout(this.timeoutId_);
      this.timeoutId_ = null;
      this.player_.off('play', this.clearTimeout_);
      this.hooks_.onStop?.();
    }
  };

  /** Whether a countdown to the next item is currently running. */
  isCountingDown(): boolean {
    return this.timeoutId_ != null;
  }

  /** Cancels a running countdown; the next `ended` starts a new one as usual. */
  cancel(): void {
    this.clearTimeout_();
  }

  fullReset(): void {
    this.clearTimeout_();
    this.player_.off('ended', this.startTimeout_);
    this.delay_ = null;
  }
}