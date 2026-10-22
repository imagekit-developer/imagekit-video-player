import type Player from 'video.js/dist/types/player';
import { FLOATING_CHANGE_EVENT } from '../floating-player';

/** An overlay that covers the player (recommendations, shoppable post-play). */
export interface PlayerOverlay {
  /** The overlay's root element, a direct child of the player element. */
  el: HTMLElement;
  /** When several overlays want to show at once, the highest priority goes first. */
  priority: number;
  /** Makes the overlay visible; moves focus into it when `moveFocus`. */
  show(moveFocus: boolean): void;
  /** Hides the overlay. Focus is handled by the manager. */
  hide(): void;
}

interface CloseOptions {
  /** Show the next waiting overlay (default). False drops them: the viewer keeps watching. */
  showNext?: boolean;
  /** Return focus to the player itself instead of the play control (a new source is loading). */
  focusPlayer?: boolean;
}

/**
 * Shows the player's overlays one at a time and is the only one to make the rest of
 * the player inert behind them, so closing one overlay can't undo another's inert or
 * leave focus behind a visible overlay (WCAG 2.1.1, 2.4.3).
 */
class PlayerOverlays {
  private current_: PlayerOverlay | null = null;
  private waiting_: PlayerOverlay[] = [];
  private moveFocus_ = false;
  private openTimer_: number | null = null;
  private inerted_: Element[] = [];

  constructor(private player_: Player) {
    // A new source makes every end-of-video overlay stale.
    player_.on('loadstart', () => this.closeAll_());
    player_.on(FLOATING_CHANGE_EVENT, () => this.onFloatingChange_());
  }

  /**
   * Asks for `overlay` to be shown. Overlays asking in the same task (e.g. two
   * `ended` handlers) are collected first, so the highest priority one shows.
   */
  open(overlay: PlayerOverlay, moveFocus: boolean): void {
    if (overlay === this.current_ || this.waiting_.includes(overlay)) return;
    this.waiting_.push(overlay);
    this.waiting_.sort((a, b) => b.priority - a.priority);
    this.moveFocus_ = this.moveFocus_ || moveFocus;
    if (this.current_ || this.openTimer_ != null) return;
    this.openTimer_ = window.setTimeout(() => {
      this.openTimer_ = null;
      const moveFocus = this.moveFocus_;
      this.moveFocus_ = false;
      this.showNext_(moveFocus);
    }, 0);
  }

  /** Closes `overlay`, or takes it out of the queue if it is still waiting. */
  close(overlay: PlayerOverlay, { showNext = true, focusPlayer = false }: CloseOptions = {}): void {
    const waitingIndex = this.waiting_.indexOf(overlay);
    if (waitingIndex !== -1) {
      this.waiting_.splice(waitingIndex, 1);
      return;
    }
    if (overlay !== this.current_) return;

    const focusWasInOverlay = overlay.el.contains(document.activeElement);
    const focusWasInPlayer = (this.player_.el() as HTMLElement).contains(document.activeElement);
    overlay.hide();
    this.current_ = null;
    this.setInert_(null);

    if (!showNext) this.waiting_ = [];
    if (this.waiting_.length) {
      this.showNext_(focusWasInPlayer);
    } else if (focusWasInOverlay) {
      this.focusPlayer_(focusPlayer);
    }
  }

  private showNext_(moveFocus: boolean) {
    // The floating mini-player hides overlays (floating-player.css), so making the rest
    // inert would leave a player nothing can be clicked in. They wait until it docks.
    if (this.isFloating_()) {
      this.moveFocus_ = this.moveFocus_ || moveFocus;
      return;
    }
    const next = this.waiting_.shift();
    if (!next) return;
    this.current_ = next;
    this.setInert_(next);
    next.show(moveFocus);
  }

  private isFloating_(): boolean {
    return (this.player_.el() as HTMLElement).classList.contains('ik-player-floating');
  }

  private onFloatingChange_() {
    if (!this.isFloating_()) {
      if (!this.current_ && this.openTimer_ == null && this.waiting_.length) {
        const moveFocus = this.moveFocus_;
        this.moveFocus_ = false;
        this.showNext_(moveFocus);
      }
      return;
    }
    if (!this.current_) return;
    // Started floating with an overlay up: queue it again until the player docks.
    const overlay = this.current_;
    const focusWasInOverlay = overlay.el.contains(document.activeElement);
    overlay.hide();
    this.current_ = null;
    this.setInert_(null);
    this.waiting_.push(overlay);
    this.waiting_.sort((a, b) => b.priority - a.priority);
    this.moveFocus_ = this.moveFocus_ || focusWasInOverlay;
    if (focusWasInOverlay) this.focusPlayer_(true);
  }

  private closeAll_() {
    if (this.openTimer_ != null) clearTimeout(this.openTimer_);
    this.openTimer_ = null;
    this.waiting_ = [];
    this.moveFocus_ = false;
    if (this.current_) this.close(this.current_, { showNext: false, focusPlayer: true });
  }

  /** Makes everything in the player except `overlay` inert, or undoes that for null. */
  private setInert_(overlay: PlayerOverlay | null) {
    this.inerted_.forEach((el) => el.removeAttribute('inert'));
    this.inerted_ = [];
    if (!overlay) return;
    this.inerted_ = Array.from((this.player_.el() as HTMLElement).children)
      .filter((el) => el !== overlay.el && !el.hasAttribute('inert'));
    this.inerted_.forEach((el) => el.setAttribute('inert', ''));
  }

  // The control bar is hidden while a new source loads; the player itself never is.
  private focusPlayer_(playerItself: boolean) {
    const playToggle = (this.player_ as any).getChild('ControlBar')?.getChild('PlayToggle')?.el() as HTMLElement | undefined;
    const target = !playerItself && playToggle && playToggle.offsetParent !== null ? playToggle : (this.player_.el() as HTMLElement);
    target.focus();
  }
}

const managers = new WeakMap<Player, PlayerOverlays>();

/** The overlay manager of `player`, created on first use. */
export function playerOverlays(player: Player): PlayerOverlays {
  let manager = managers.get(player);
  if (!manager) {
    manager = new PlayerOverlays(player);
    managers.set(player, manager);
  }
  return manager;
}
