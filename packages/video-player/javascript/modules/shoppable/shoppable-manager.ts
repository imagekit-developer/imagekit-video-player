import type Player from 'video.js/dist/types/player';
import type {
  ShoppableProps,
  ProductProps,
  Hotspot,
  InteractionProps,
} from '../../interfaces';
import { AugmentedSourceOptions } from 'javascript/interfaces/AugementedSourceOptions';
import { CleanupRegistry } from '../../utils';
import ShoppablePanelItem, { getProductRole } from './shoppable-item';

const isActivationKey = (event: KeyboardEvent) => event.key === 'Enter' || event.key === ' ';

const prefersReducedMotion = () =>
  typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export class ShoppableManager {
  private player_: Player;
  private shoppable_: ShoppableProps;
  private barContainer_: HTMLDivElement | null = null;
  private panelEl_: HTMLDivElement | null = null;
  private toggleButton_: HTMLDivElement | null = null;
  private hotspotElements_: { element: HTMLDivElement; hotspot: Hotspot; product: ProductProps }[] = [];
  private postPlayOverlay_: HTMLDivElement | null = null;
  private tickHandler_: (() => void) | null = null;
  private endedHandler_: (() => void) | null = null;
  private autoCloseTimeout_: any = null;
  private initialAnimationTimeout_: any = null;
  private pauseTimeout_: any = null;
  private sourceItem_: AugmentedSourceOptions;
  private currentActiveProductId_: string | number | null = null;
  // Player children made inert while the post-play overlay is shown.
  private inertedEls_: Element[] = [];
  private cleanup_ = new CleanupRegistry();

  constructor(player: Player, src: AugmentedSourceOptions) {
    this.player_ = player;
    this.sourceItem_ = src;
    this.shoppable_ = src.shoppable;
    // Build all the necessary DOM elements first.
    this.buildProductBar();
    this.buildHotspots();
    this.player_.ready(() => {
      // Attach the time-update listener for highlights and hotspots.
      this.tickHandler_ = this.onTimeUpdate.bind(this);
      this.cleanup_.registerVideoJsListener(this.player_, 'timeupdate', this.tickHandler_);

      // Set up the post-play overlay if configured.
      if (this.shoppable_.showPostPlayOverlay) {
        this.buildPostPlayOverlay();
        this.endedHandler_ = this.onEnded.bind(this);
        this.cleanup_.registerVideoJsListener(this.player_, 'ended', this.endedHandler_);
      }

      const startState = this.shoppable_.startState || 'openOnPlay';

      this.player_.one('play', () => {
        // Always show the toggle button on the first play.
        this.toggleButton_?.classList.remove('vjs-hidden');

        // If the state is 'openOnPlay', open the bar now.
        if (startState === 'openOnPlay') {
          this.openBar();
        }
      });

      if (startState === 'open') {
        // If the state is 'open', open the bar and show the button immediately.
        // Because this is inside ready(), it's safe to do now.
        this.openBar();
        this.toggleButton_?.classList.remove('vjs-hidden');
      } else if (startState === 'closed') {
        // If the state is 'closed', hide the bar and set the animation timeout.
        this.closeBar(true);
        this.initialAnimationTimeout_ = this.cleanup_.registerTimeout(() => {
          // The 'play' listener above will handle unhiding the button.
          this.toggleButton_?.classList.add('animate');
        }, 3000);
      }
    });
  }

  private scrollToActiveItem(activeItem: HTMLElement) {
    if (!this.panelEl_) {
      return;
    }

    // Don't scroll the panel out from under a keyboard user browsing it.
    if (this.panelEl_.contains(document.activeElement)) {
      return;
    }

    const toScroll = activeItem.offsetTop - 12; // 12px offset for better spacing

    // Use the modern, smooth scroll behavior where available
    if ('scrollBehavior' in document.documentElement.style) {
      this.panelEl_.scrollTo({
        top: toScroll,
        behavior: prefersReducedMotion() ? 'auto' : 'smooth'
      });
    } else {
      // Fallback for older browsers
      this.panelEl_.scrollTop = toScroll;
    }
  }

  private buildProductBar() {
    const playerEl = this.player_.el();

    const bar = document.createElement('div');
    bar.className = 'vjs-shoppable-bar';

    const inner = document.createElement('div');
    inner.className = 'vjs-shoppable-bar-inner';
    bar.appendChild(inner);

    const panel = document.createElement('div');
    panel.className = 'vjs-shoppable-panel';
    panel.id = `${this.player_.id()}-shoppable-panel`;
    panel.setAttribute('role', 'group');
    panel.setAttribute('aria-label', this.player_.localize('Products'));
    // The panel starts off-screen; keep it out of the tab order until opened.
    panel.setAttribute('inert', '');
    inner.appendChild(panel);
    this.panelEl_ = panel;

    const toggle = document.createElement('div');
    toggle.className = 'vjs-shoppable-toggle';
    toggle.setAttribute('role', 'button');
    toggle.setAttribute('tabindex', '0');
    toggle.setAttribute('aria-label', this.player_.localize('Products'));
    toggle.setAttribute('aria-controls', panel.id);
    toggle.setAttribute('aria-expanded', 'false');

    const openIconUrl = this.shoppable_.toggleIconUrl || 'https://imagekit.io/icons/icon-144x144.png';
    const closeIconUrl = 'https://imagekit.io/icons/icon-144x144.png';

    const openIcon = document.createElement('div');
    openIcon.className = 'vjs-shoppable-toggle-icon icon-open';
    openIcon.style.backgroundImage = `url('${openIconUrl}')`;

    const closeIcon = document.createElement('div');
    closeIcon.className = 'vjs-shoppable-toggle-icon icon-close';
    closeIcon.style.backgroundImage = `url('${closeIconUrl}')`;

    openIcon.setAttribute('aria-hidden', 'true');
    closeIcon.setAttribute('aria-hidden', 'true');

    toggle.appendChild(openIcon);
    toggle.appendChild(closeIcon);
    this.cleanup_.registerEventListener(toggle, 'click', () => this.toggleBar());
    this.cleanup_.registerEventListener(toggle, 'keydown', (e: Event) => {
      if (!isActivationKey(e as KeyboardEvent)) return;
      e.preventDefault();
      e.stopPropagation();
      this.toggleBar();
    });

    this.toggleButton_ = toggle;
    this.toggleButton_?.classList.add('vjs-hidden');
    // Toggle goes before the panel so Tab moves from the toggle into the products it opens.
    inner.insertBefore(this.toggleButton_, panel);

    this.shoppable_.products.forEach((prod, index) => {

      const clickhandler_ = (e: MouseEvent) => {
        e.preventDefault();
        this.player_.trigger('productClick', { product: prod });
        this.resetAutoClose();
        if (prod.onClick) this.handleClickInteraction(prod.onClick, prod);
      };

      const item = new ShoppablePanelItem(this.player_, {
        item: prod,
        index: index,
        transformation: this.shoppable_.transformation,
        source: this.sourceItem_,
        clickHandler: clickhandler_,
      });
      panel.appendChild(item.el());
    });

    this.barContainer_ = bar;
    playerEl.appendChild(this.barContainer_);
  }

  private buildHotspots() {
    this.shoppable_.products.forEach(product => {
      if (!product.hotspots) return;

      product.hotspots.forEach(hotspot => {
        const hsElement = document.createElement('div');
        hsElement.className = 'vjs-shoppable-hotspot vjs-hidden';
        hsElement.style.left = hotspot.x;
        hsElement.style.top = hotspot.y;
        hsElement.setAttribute('role', getProductRole(product));
        hsElement.setAttribute('tabindex', '0');
        hsElement.setAttribute('aria-label', product.productName);

        const tooltip = document.createElement('div');
        tooltip.className = 'vjs-shoppable-hotspot-tooltip vjs-hidden';
        tooltip.textContent = product.productName;
        // Same text as the hotspot's aria-label; don't announce it twice.
        tooltip.setAttribute('aria-hidden', 'true');
        const position = hotspot.tooltipPosition || 'top';
        tooltip.classList.add(`tooltip-position-${position}`);
        hsElement.appendChild(tooltip);

        const showTooltip = () => tooltip.classList.remove('vjs-hidden');
        const hideTooltip = () => tooltip.classList.add('vjs-hidden');
        const activate = () => {
          this.player_.trigger('productClick', { product });
          if (product.onClick) this.handleClickInteraction(product.onClick, product);
        };

        // The tooltip shows on hover and on keyboard focus, and stays while either applies.
        this.cleanup_.registerEventListener(hsElement, 'mouseenter', showTooltip);
        this.cleanup_.registerEventListener(hsElement, 'mouseleave', () => {
          if (document.activeElement !== hsElement) hideTooltip();
        });
        this.cleanup_.registerEventListener(hsElement, 'focus', showTooltip);
        this.cleanup_.registerEventListener(hsElement, 'blur', () => {
          if (!hsElement.matches(':hover')) hideTooltip();
        });
        this.cleanup_.registerEventListener(hsElement, 'click', activate);
        this.cleanup_.registerEventListener(hsElement, 'keydown', (e: Event) => {
          const event = e as KeyboardEvent;
          if (event.key === 'Escape') {
            event.stopPropagation();
            hideTooltip();
          } else if (isActivationKey(event)) {
            event.preventDefault();
            event.stopPropagation();
            activate();
          }
        });

        this.player_.el().appendChild(hsElement);
        this.hotspotElements_.push({ element: hsElement, hotspot, product });
      });
    });
  }

  private onTimeUpdate() {
    const currentTime = this.player_.currentTime();
    if (typeof currentTime !== 'number') return;

    this.shoppable_.products.forEach(prod => {
      const itemEl = this.panelEl_?.querySelector(`[data-product-id="${prod.productId}"]`);
      if (!itemEl) return;

      if (prod.highlightTime) {
        const { start, end } = prod.highlightTime;
        const isActive = currentTime >= start && currentTime <= end;

        if (isActive) {
          // REFINED: Only scroll if the active item is new.
          if (prod.productId !== this.currentActiveProductId_) {
            itemEl.classList.add('active');
            itemEl.setAttribute('aria-current', 'true');
            this.currentActiveProductId_ = prod.productId;
            this.scrollToActiveItem(itemEl as HTMLElement);
          }
        } else {
          // If the item is no longer active, remove the class and reset tracking if it was the one being tracked.
          if (itemEl.classList.contains('active')) {
            itemEl.classList.remove('active');
            itemEl.removeAttribute('aria-current');
            if (prod.productId === this.currentActiveProductId_) {
              this.currentActiveProductId_ = null;
            }
          }
        }
      }
    });

    this.hotspotElements_.forEach(hsData => {
      const hotspotTime = ShoppableManager.toSeconds(hsData.hotspot.time);
      if (Math.abs(currentTime - hotspotTime) < 0.5) {
        hsData.element.classList.remove('vjs-hidden');
      } else if (document.activeElement !== hsData.element) {
        // A focused hotspot stays until focus leaves it, so keyboard focus isn't dropped.
        hsData.element.classList.add('vjs-hidden');
      }
    });
  }

  private onEnded() {
    // Only pull focus into the overlay if the user was already working inside the player.
    const focusWasInPlayer = this.player_.el().contains(document.activeElement);
    if (this.closeBar) {
      this.closeBar(true);
    }
    if (this.postPlayOverlay_) {
      this.postPlayOverlay_.classList.remove('vjs-hidden');
      if (this.toggleButton_) this.toggleButton_.classList.add('vjs-hidden');
      this.setPlayerBackgroundInert(true);
      if (focusWasInPlayer) {
        const firstFocusable = this.postPlayOverlay_.querySelector<HTMLElement>('[tabindex="0"]');
        (firstFocusable || this.postPlayOverlay_).focus();
      }
      this.player_.trigger('productHoverPost', {});
    }
  }

  /**
   * Hides the post-play overlay. If focus was inside it, focus moves to the
   * play control so it isn't lost on a hidden element.
   */
  private hidePostPlayOverlay() {
    if (!this.postPlayOverlay_) return;
    const focusWasInOverlay = this.postPlayOverlay_.contains(document.activeElement);
    this.postPlayOverlay_.classList.add('vjs-hidden');
    this.setPlayerBackgroundInert(false);
    if (this.toggleButton_) this.toggleButton_.classList.remove('vjs-hidden');
    if (focusWasInOverlay) this.focusPlayControl();
  }

  /**
   * While the post-play overlay covers the player, the controls underneath are
   * made inert so keyboard and screen-reader users can't land on hidden controls.
   */
  private setPlayerBackgroundInert(inert: boolean) {
    if (inert) {
      // Other visible dialogs (e.g. the recommendations overlay) are left alone.
      this.inertedEls_ = Array.from(this.player_.el().children).filter(el =>
        el !== this.postPlayOverlay_ &&
        !el.hasAttribute('inert') &&
        !(el.getAttribute('role') === 'dialog' && !el.classList.contains('vjs-hidden'))
      );
      this.inertedEls_.forEach(el => el.setAttribute('inert', ''));
    } else {
      this.inertedEls_.forEach(el => el.removeAttribute('inert'));
      this.inertedEls_ = [];
    }
  }

  private focusPlayControl() {
    const playToggle = (this.player_ as any).getChild('ControlBar')?.getChild('PlayToggle')?.el() as HTMLElement | undefined;
    (playToggle || this.player_.el() as HTMLElement).focus();
  }

  // Replace the existing buildPostPlayOverlay method with this one.

  private buildPostPlayOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'vjs-shoppable-postplay-overlay vjs-hidden';
    // Not aria-modal: the overlay only covers the player, the rest of the page stays usable.
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('tabindex', '-1');

    const title = document.createElement('div');
    title.className = 'vjs-shoppable-postplay-title';
    title.id = `${this.player_.id()}-shoppable-postplay-title`;
    title.textContent = this.player_.localize('Shop the Video');
    overlay.setAttribute('aria-labelledby', title.id);
    overlay.appendChild(title);

    // Capture phase: product items (ClickableComponent) stop Escape before it would bubble here.
    this.cleanup_.registerEventListener(overlay, 'keydown', (e: Event) => {
      if ((e as KeyboardEvent).key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      this.hidePostPlayOverlay();
    }, true);
    // Keep keys inside the overlay from reaching the player shortcuts underneath.
    this.cleanup_.registerEventListener(overlay, 'keydown', (e: Event) => e.stopPropagation());

    const carousel = document.createElement('div');
    carousel.className = 'vjs-shoppable-postplay-carousel';
    overlay.appendChild(carousel);

    // --- START: Make carousel grabbable ---
    let isDown = false;
    let startX: number;
    let scrollLeft: number;

    this.cleanup_.registerEventListener(carousel, 'mousedown', (e: MouseEvent) => {
      isDown = true;
      carousel.classList.add('is-grabbing');
      // Get initial mouse position and scroll position
      startX = e.pageX - carousel.offsetLeft;
      scrollLeft = carousel.scrollLeft;
    });

    this.cleanup_.registerEventListener(carousel, 'mouseleave', () => {
      isDown = false;
      carousel.classList.remove('is-grabbing');
    });

    this.cleanup_.registerEventListener(carousel, 'mouseup', () => {
      isDown = false;
      carousel.classList.remove('is-grabbing');
    });

    this.cleanup_.registerEventListener(carousel, 'mousemove', (e: MouseEvent) => {
      if (!isDown) return; // Stop if mouse is not clicked down
      e.preventDefault(); // Prevent default dragging behavior (like text selection)
      const x = e.pageX - carousel.offsetLeft;
      const walk = (x - startX) * 2; // The multiplier makes scrolling feel faster
      carousel.scrollLeft = scrollLeft - walk;
    });
    // --- END: Make carousel grabbable ---

    this.shoppable_.products.forEach((prod, index) => {
      // Define the specific click handler for items in the post-play overlay.
      const postPlayClickHandler = () => {
        this.player_.trigger('productClickPost', { product: prod });
        if (!prod.onClick) return;

        // Special handling for 'seek': close overlay and start playing.
        if (prod.onClick.action === 'seek' && prod.onClick.args?.time) {
          this.hidePostPlayOverlay();
          this.player_.currentTime(ShoppableManager.toSeconds(prod.onClick.args.time));
          this.player_.play();
        } else {
          // Handle other actions like 'goto' normally.
          this.handleClickInteraction(prod.onClick, prod);
        }
      };

      // Create an instance of the component for the post-play screen.
      const item = new ShoppablePanelItem(this.player_, {
        item: prod,
        index: index,
        transformation: this.shoppable_.transformation,
        source: this.sourceItem_,
        clickHandler: postPlayClickHandler,
      });
      
      carousel.appendChild(item.el());

    });

    const replayBtn = document.createElement('div');
    replayBtn.className = 'vjs-shoppable-replay-btn';
    replayBtn.setAttribute('role', 'button');
    replayBtn.setAttribute('tabindex', '0');

    // Create a span for the icon and add the Video.js icon class to it
    const replayIcon = document.createElement('span');
    replayIcon.className = 'vjs-icon-replay';
    replayIcon.setAttribute('aria-hidden', 'true'); // Hide decorative icon from screen readers

    // Create a span for the text
    const replayText = document.createElement('span');
    replayText.textContent = this.player_.localize('Replay');

    // Add the new icon and text spans to the button
    replayBtn.appendChild(replayIcon);
    replayBtn.appendChild(replayText);

    const replayAction = () => {
      this.hidePostPlayOverlay();
      this.player_.play();
    };

    replayBtn.onclick = replayAction;
    replayBtn.onkeydown = (e) => {
      if (isActivationKey(e)) {
        e.preventDefault();
        // Otherwise Space also reaches the player shortcut and pauses the replay.
        e.stopPropagation();
        replayAction();
      }
    };

    overlay.appendChild(replayBtn);

    this.postPlayOverlay_ = overlay;
    this.player_.el().appendChild(overlay);
  }

  private toggleBar() {
    if (this.initialAnimationTimeout_) clearTimeout(this.initialAnimationTimeout_);
    this.toggleButton_?.classList.remove('animate');

    const playerEl = this.player_.el();
    if (playerEl.classList.contains('shoppable-panel-visible')) {
      this.closeBar();
    } else {
      this.openBar();
    }
  }

  private openBar() {
    const playerEl = this.player_.el();
    playerEl.classList.remove('shoppable-panel-hidden');
    playerEl.classList.add('shoppable-panel-visible');
    this.panelEl_?.removeAttribute('inert');
    this.toggleButton_?.setAttribute('aria-expanded', 'true');
    this.player_.trigger('productBarMax');
    this.resetAutoClose();
  }

  private closeBar(immediate = false) {
    const playerEl = this.player_.el();
    // Focus inside the panel would be lost once it becomes inert; hand it to the toggle.
    if (this.panelEl_?.contains(document.activeElement)) {
      this.toggleButton_?.focus();
    }
    playerEl.classList.remove('shoppable-panel-visible');
    this.panelEl_?.setAttribute('inert', '');
    this.toggleButton_?.setAttribute('aria-expanded', 'false');
    if (immediate) {
      playerEl.classList.add('shoppable-panel-hidden');
    }
    this.player_.trigger('productBarMin');
    if (this.autoCloseTimeout_) clearTimeout(this.autoCloseTimeout_);
  }

  private resetAutoClose() {
    if (this.autoCloseTimeout_) clearTimeout(this.autoCloseTimeout_);
    const autoCloseTime = this.shoppable_.autoClose;
    if (typeof autoCloseTime === 'number' && autoCloseTime > 0) {
      this.autoCloseTimeout_ = this.cleanup_.registerTimeout(() => {
        // Don't close the panel while a keyboard user is in it; check again later.
        if (this.barContainer_?.contains(document.activeElement)) {
          this.resetAutoClose();
          return;
        }
        this.closeBar();
      }, autoCloseTime * 1000);
    }
  }

  private static toSeconds(time: string): number {
    const parts = time.split(':').map(p => parseFloat(p));
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return parseFloat(time) || 0;
  }

  private handleClickInteraction(interaction: InteractionProps, product: ProductProps) {
    const { action, pause, args } = interaction;
    switch (action) {
      case 'seek':
        if (args?.time) {
          this.player_.currentTime(ShoppableManager.toSeconds(args.time));
          // This logic runs first for any interaction that includes the 'pause' property.
          if (pause) {
            // Always pause the player immediately if 'pause' is true or a number.
            this.player_.pause();

            // If 'pause' is a number, it specifies a duration in seconds to pause.
            // After this duration, the video will automatically resume playing.
            if (typeof pause === 'number' && pause > 0) {
              // Before setting a new timeout, clear any existing one. This prevents
              // multiple resume timers from running if the user clicks rapidly.
              if (this.pauseTimeout_) {
                clearTimeout(this.pauseTimeout_);
              }

              // Schedule the player to resume playback after the specified duration.
              this.pauseTimeout_ = this.cleanup_.registerTimeout(() => {
                this.player_.play();
              }, pause * 1000);
            }
            // If 'pause' is simply `true`, the video will remain paused indefinitely,
            // waiting for the user to manually click play.
          }
        }
        break;
      case 'goto':
        if (args?.url) {
          if (pause) {
            // Always pause the player immediately if 'pause' is true or a number.
            this.player_.pause();

            // If 'pause' is a number, it specifies a duration in seconds to pause.
            // After this duration, the video will automatically resume playing.
            if (typeof pause === 'number' && pause > 0) {
              // Before setting a new timeout, clear any existing one. This prevents
              // multiple resume timers from running if the user clicks rapidly.
              if (this.pauseTimeout_) {
                clearTimeout(this.pauseTimeout_);
              }

              // Schedule the player to resume playback after the specified duration.
              this.pauseTimeout_ = this.cleanup_.registerTimeout(() => {
                this.player_.play();
              }, pause * 1000);
            }
            // If 'pause' is simply `true`, the video will remain paused indefinitely,
            // waiting for the user to manually click play.
          }
          window.open(args.url, '_blank');
        }
        break;
      default:
        break;
    }
  }

  public destroy() {
    if (this.closeBar) {
      this.closeBar(true);
    }
    this.setPlayerBackgroundInert(false);
    
    // Register DOM elements for cleanup
    if (this.barContainer_) {
      this.cleanup_.registerElement(this.barContainer_);
    }
    this.hotspotElements_.forEach(hs => {
      this.cleanup_.registerElement(hs.element);
    });
    if (this.postPlayOverlay_) {
      this.cleanup_.registerElement(this.postPlayOverlay_);
    }
    
    // Register remaining timeouts for cleanup
    if (this.autoCloseTimeout_) {
      this.cleanup_.register(() => clearTimeout(this.autoCloseTimeout_!));
    }
    if (this.initialAnimationTimeout_) {
      this.cleanup_.register(() => clearTimeout(this.initialAnimationTimeout_!));
    }
    if (this.pauseTimeout_) {
      this.cleanup_.register(() => clearTimeout(this.pauseTimeout_!));
    }
    
    // Clean up everything
    this.cleanup_.dispose();
  }
}
