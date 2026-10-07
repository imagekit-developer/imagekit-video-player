import videojs from 'video.js';
import type Player from 'video.js/dist/types/player';
import { IKPlayerOptions, SourceOptions } from '../../interfaces';
import { preparePosterSrc, CleanupRegistry } from '../../utils';
import { UP_NEXT_EVENTS } from '../playlist/up-next-events';

const Component = videojs.getComponent('Component');

const isActivationKey = (event: KeyboardEvent) => event.key === 'Enter' || event.key === ' ';

interface RecommendationsOverlayOptions {
  recommendations: SourceOptions[];
  playerOptions: IKPlayerOptions;
  children?: any[];
  className?: string;
}

export class RecommendationsOverlay extends Component {
  private recommendations: SourceOptions[];
  private playerOptions: IKPlayerOptions;
  private gridEl!: HTMLDivElement;
  private closeBtn!: HTMLButtonElement;
  // Player children made inert while the overlay is shown.
  private inertedEls_: Element[] = [];
  // A playlist "Up next" countdown is running; wait for it instead of covering it.
  private upNextActive_ = false;
  // Video ended during a countdown: show the recommendations if the viewer cancels it.
  private pendingShow_ = false;
  private endedTimer_: number | null = null;
  private cleanup_ = new CleanupRegistry();

  constructor(player: Player, options: RecommendationsOverlayOptions) {
    super(player, options);
    this.recommendations = options.recommendations || [];
    this.playerOptions = options.playerOptions;

    this.hide(); // start hidden

    // Build elements using the correct static method
    this.gridEl    = videojs.dom.createEl('div', { className: 'vjs-rec-list' }) as HTMLDivElement;
    this.closeBtn  = videojs.dom.createEl('div', { className: 'vjs-rec-close' }) as HTMLButtonElement;
    this.closeBtn.innerHTML = '&#10005;'; // ×
    this.closeBtn.setAttribute('role', 'button');
    this.closeBtn.setAttribute('tabindex', '0');
    this.closeBtn.setAttribute('aria-label', this.localize('Close'));

    // Not aria-modal: the overlay only covers the player, the rest of the page stays usable.
    this.el().setAttribute('role', 'dialog');
    this.el().setAttribute('aria-label', this.localize('Recommended videos'));
    this.el().setAttribute('tabindex', '-1');

    // Assemble
    this.el().appendChild(this.closeBtn);
    this.el().appendChild(this.gridEl);

    // Listeners
    this.cleanup_.registerVideoJsListener(player, 'ended', this.onEnded);
    this.cleanup_.registerVideoJsListener(player, UP_NEXT_EVENTS.START, () => { this.upNextActive_ = true; });
    this.cleanup_.registerVideoJsListener(player, UP_NEXT_EVENTS.END, () => { this.upNextActive_ = false; });
    this.cleanup_.registerVideoJsListener(player, UP_NEXT_EVENTS.CANCEL, () => {
      if (!this.pendingShow_) return;
      this.pendingShow_ = false;
      this.openOverlay_(this.player_.el().contains(document.activeElement));
    });
    this.cleanup_.registerVideoJsListener(player, 'play', () => { this.pendingShow_ = false; });
    // A new source makes these recommendations stale: close them (and un-inert the player).
    this.cleanup_.registerVideoJsListener(player, 'loadstart', () => {
      this.pendingShow_ = false;
      this.upNextActive_ = false;
      if (!this.hasClass('vjs-hidden')) this.closeOverlay(true);
    });
    this.cleanup_.registerEventListener(this.closeBtn, 'click', () => this.closeOverlay());
    this.cleanup_.registerEventListener(this.closeBtn, 'keydown', (e: Event) => {
      if (!isActivationKey(e as KeyboardEvent)) return;
      e.preventDefault();
      this.closeOverlay();
    });
    // Capture phase so Escape closes the overlay from any element inside it.
    this.cleanup_.registerEventListener(this.el(), 'keydown', (e: Event) => {
      if ((e as KeyboardEvent).key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      this.closeOverlay();
    }, true);
    // Keep keys inside the overlay from reaching the player shortcuts underneath.
    this.cleanup_.registerEventListener(this.el(), 'keydown', (e: Event) => e.stopPropagation());
  }

  createEl() {
    return super.createEl('div', { className: 'vjs-recommendations-overlay' });
  }

  private onEnded = () => {
    // Only pull focus into the overlay if the user was already working inside the player.
    const focusWasInPlayer = this.player_.el().contains(document.activeElement);
    // Let a playlist auto-advance (also on 'ended') start its countdown first.
    if (this.endedTimer_ != null) clearTimeout(this.endedTimer_);
    this.endedTimer_ = window.setTimeout(() => {
      this.endedTimer_ = null;
      if (this.upNextActive_) {
        this.pendingShow_ = true;
        return;
      }
      this.openOverlay_(focusWasInPlayer);
    }, 0);
  };

  private openOverlay_(moveFocus: boolean) {
    this.renderRecommendations();
    this.show();
    this.setPlayerBackgroundInert(true);
    if (moveFocus) {
      const firstCard = this.gridEl.querySelector<HTMLElement>('.vjs-rec-item');
      (firstCard || this.el() as HTMLElement).focus();
    }
  }

  /**
   * Hides the overlay. If focus was inside it, focus moves to the play control
   * (or the player root) so it isn't lost on a hidden element.
   */
  private closeOverlay(focusPlayerRoot = false) {
    const focusWasInOverlay = this.el().contains(document.activeElement);
    this.hide();
    this.setPlayerBackgroundInert(false);
    if (focusWasInOverlay && focusPlayerRoot) {
      (this.player_.el() as HTMLElement).focus();
    } else if (focusWasInOverlay) {
      const playToggle = (this.player_ as any).getChild('ControlBar')?.getChild('PlayToggle')?.el() as HTMLElement | undefined;
      (playToggle || this.player_.el() as HTMLElement).focus();
    }
  }

  /**
   * While the overlay covers the player, the controls underneath are made inert
   * so keyboard and screen-reader users can't land on hidden controls. Other
   * visible dialogs (e.g. the shoppable post-play overlay) are left alone.
   */
  private setPlayerBackgroundInert(inert: boolean) {
    if (inert) {
      this.inertedEls_ = Array.from((this.player_.el() as HTMLElement).children).filter(el =>
        el !== this.el() &&
        !el.hasAttribute('inert') &&
        !(el.getAttribute('role') === 'dialog' && !el.classList.contains('vjs-hidden'))
      );
      this.inertedEls_.forEach(el => el.setAttribute('inert', ''));
    } else {
      this.inertedEls_.forEach(el => el.removeAttribute('inert'));
      this.inertedEls_ = [];
    }
  }

  private renderRecommendations() {
    this.gridEl.innerHTML = '';
    this.recommendations.forEach(rec => {
      const card = this._createRecommendationItem(rec);
      this.gridEl.appendChild(card);
    });
  }

  // Add this new private helper method to the RecommendationsOverlay class

  /**
   * Creates a single recommendation item element, including the logic
   * for asynchronously loading its poster.
   * @param rec - The source options for the recommendation item.
   * @returns A complete HTML element for the card.
   * @private
   */
  private _createRecommendationItem(rec: SourceOptions): HTMLDivElement {
    const card = videojs.dom.createEl('div', { className: 'vjs-rec-item' }) as HTMLDivElement;
    const thumb = videojs.dom.createEl('div', { className: 'vjs-rec-thumb' }) as HTMLDivElement;
    
    // Create and add the title label INSIDE the thumbnail container.
    // This is crucial for the overlay styling to work correctly.
    const label = videojs.dom.createEl('div', { className: 'vjs-rec-title' }) as HTMLDivElement;
    label.textContent = rec.info?.title || '';
    // Thumbnail is a CSS background, so the title is the card's only name.
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    if (!rec.info?.title) card.setAttribute('aria-label', this.localize('Untitled video'));
    
    // Create and add the spinner.
    const spinner = videojs.dom.createEl('div', { className: 'vjs-rec-thumb-spinner' });
    thumb.appendChild(spinner);

    // Assemble the card structure correctly.
    card.appendChild(thumb);
    thumb.appendChild(label); // Append label to thumb for overlay effect

    // Asynchronously load the poster.
    preparePosterSrc(rec, this.playerOptions)
      .then((url) => {
        // On success, remove spinner and set the background image.
        spinner.remove();
        thumb.style.backgroundImage = `url('${url}')`;
      })
      .catch((err) => {
        // On failure, remove spinner and apply a placeholder style to the thumbnail.
        this.player_.log.error(`Failed to load poster for recommendation item: ${err.message}`);
        spinner.remove();
        // CORRECTED: Apply the placeholder class to the 'thumb' element, not the removed spinner.
        thumb.classList.add('vjs-rec-thumb-placeholder');
      });

    card.onclick = () => this.onClickHandler(rec);
    card.onkeydown = (e) => {
      if (!isActivationKey(e)) return;
      e.preventDefault();
      this.onClickHandler(rec);
    };
    return card;
  }

  private onClickHandler(source: SourceOptions) {
    this.player().src(source);
    // Loading a new source resets the player and hides the control bar, so the play
    // control would lose focus; the player root is never hidden.
    this.closeOverlay(true);
  }

  dispose(): void {
    if (this.endedTimer_ != null) clearTimeout(this.endedTimer_);
    this.setPlayerBackgroundInert(false);
    this.cleanup_.dispose();
    super.dispose();
  }
}

// register component
videojs.registerComponent('RecommendationsOverlay', RecommendationsOverlay);
export default RecommendationsOverlay;