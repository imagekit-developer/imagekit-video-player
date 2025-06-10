// src/modules/shoppable/shoppable-manager.ts
import videojs from 'video.js';
import type Player from 'video.js/dist/types/player';
import type {
  ShoppableProps,
  ProductProps,
  Hotspot,
  InteractionProps
} from '../../interfaces/Shoppable';

export class ShoppableManager {
  private player_: Player;
  private shoppable_: ShoppableProps;
  private barContainer_: HTMLDivElement | null = null;
  private toggleButton_: HTMLDivElement | null = null;
  private hotspotElements_: { element: HTMLDivElement; hotspot: Hotspot; product: ProductProps }[] = [];
  private postPlayOverlay_: HTMLDivElement | null = null;
  private tickHandler_: (() => void) | null = null;
  private endedHandler_: (() => void) | null = null;
  private autoCloseTimeout_: any = null;
  private initialAnimationTimeout_: any = null;


  constructor(player: Player, shoppable: ShoppableProps) {
    this.player_ = player;
    this.shoppable_ = shoppable;

    // Build the UI immediately.
    this.buildProductBar();
    // buildToggleButton is now called inside buildProductBar
    this.buildHotspots();

    this.tickHandler_ = this.onTimeUpdate.bind(this);
    this.player_.on('timeupdate', this.tickHandler_);

    if (this.shoppable_.showPostPlayOverlay) {
      this.buildPostPlayOverlay();
      this.endedHandler_ = this.onEnded.bind(this);
      this.player_.on('ended', this.endedHandler_);
    }

    const startState = this.shoppable_.startState || 'openOnPlay';
    if (startState === 'open') {
      this.openBar();
    } else if (startState === 'openOnPlay') {
      this.player_.one('play', () => this.openBar());
    } else {
      this.closeBar(true);
        // Trigger the "tada" animation after a delay if the bar is closed initially
        this.initialAnimationTimeout_ = setTimeout(() => {
          this.toggleButton_?.classList.add('animate');
        }, 3000);
    }

    this.player_.one('play', () => {
      this.showToggleButton();
    });
  }


  // ** THIS METHOD IS REWRITTEN **
 // ** THIS METHOD IS REWRITTEN FOR ICON SWAPPING **
 private buildProductBar() {
  const playerEl = this.player_.el();
  const widthPct = this.shoppable_.width ?? 20;

  const bar = document.createElement('div');
  bar.className = 'vjs-shoppable-bar';
  
  const inner = document.createElement('div');
  inner.className = 'vjs-shoppable-bar-inner';
  bar.appendChild(inner);
  
  const panel = document.createElement('div');
  panel.className = 'vjs-shoppable-panel';
  inner.appendChild(panel);
  
  // Create the toggle button and its two icons (cart and close)
  const toggle = document.createElement('div');
  toggle.className = 'vjs-shoppable-toggle';
  
  const openIconUrl = this.shoppable_.toggleIconUrl || 'https://ik.imagekit.io/zuqlyov9d/shopping-cart-svgrepo-com.svg?updatedAt=1718002012423';
  const closeIconUrl = this.shoppable_.toggleIconUrl; // A simple cross icon

  const openIcon = document.createElement('div');
  openIcon.className = 'vjs-shoppable-toggle-icon icon-open';
  openIcon.style.backgroundImage = `url('${openIconUrl}')`;
  
  const closeIcon = document.createElement('div');
  closeIcon.className = 'vjs-shoppable-toggle-icon icon-close';
  closeIcon.style.backgroundImage = `url('${closeIconUrl}')`;

  toggle.appendChild(openIcon);
  toggle.appendChild(closeIcon);
  toggle.addEventListener('click', () => this.toggleBar());
  // Hide the button by default.
  toggle.classList.add('vjs-hidden');
  
  this.toggleButton_ = toggle;
  
  inner.appendChild(this.toggleButton_); // Append toggle to the sliding container

  this.shoppable_.products.forEach((prod) => {
    const item = document.createElement('a');
    item.className = 'vjs-shoppable-item';
    item.setAttribute('data-product-id', prod.productId);

    const img = document.createElement('img');
    img.className = 'vjs-shoppable-item-img';
    img.src = prod.imageUrl;
    img.alt = prod.productName;
    item.appendChild(img);
    
    const info = document.createElement('div');
    info.className = 'vjs-shoppable-item-info';
    info.textContent = prod.productName;
    item.appendChild(info);
    
    item.addEventListener('mouseenter', () => {
      this.player_.trigger('productHover', { product: prod });
      this.resetAutoClose();
      if (prod.onHover) this.handleInteraction(prod.onHover, prod);
    });
    
    item.addEventListener('click', (e) => {
      e.preventDefault();
      this.player_.trigger('productClick', { product: prod });
      this.resetAutoClose();
      if (prod.onClick) this.handleInteraction(prod.onClick, prod);
    });
    
    panel.appendChild(item);
  });

  this.barContainer_ = bar;
  playerEl.appendChild(this.barContainer_);
}



  private buildToggleButton() {
    const toggle = document.createElement('div');
    toggle.className = 'vjs-shoppable-toggle';

    const iconUrl = this.shoppable_.toggleIconUrl || 'https://ik.imagekit.io/zuqlyov9d/shopping-cart-svgrepo-com.svg?updatedAt=1718002012423';
    const icon = document.createElement('div');
    icon.className = 'vjs-shoppable-toggle-icon';
    icon.style.backgroundImage = `url('${iconUrl}')`;

    toggle.appendChild(icon);
    toggle.addEventListener('click', () => this.toggleBar());

    this.toggleButton_ = toggle;
    // **FIX 2**: Append the toggle button directly to the player element.
    // This makes it independent of the sliding bar.
    this.player_.el().appendChild(this.toggleButton_);
  }

  private buildHotspots() {
    this.shoppable_.products.forEach(product => {
      if (!product.hotspots) return;

      product.hotspots.forEach(hotspot => {
        const hsElement = document.createElement('div');
        hsElement.className = 'vjs-shoppable-hotspot vjs-hidden';
        hsElement.style.left = hotspot.x;
        hsElement.style.top = hotspot.y;

        const tooltip = document.createElement('div');
        tooltip.className = 'vjs-shoppable-hotspot-tooltip vjs-hidden';
        tooltip.textContent = product.productName;
        hsElement.appendChild(tooltip);

        hsElement.addEventListener('mouseenter', () => tooltip.classList.remove('vjs-hidden'));
        hsElement.addEventListener('mouseleave', () => tooltip.classList.add('vjs-hidden'));
        hsElement.addEventListener('click', () => {
          this.player_.trigger('productClick', { product });
          if (product.onClick) this.handleInteraction(product.onClick, product);
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
      const itemEl = this.barContainer_?.querySelector(`[data-product-id="${prod.productId}"]`);
      if (!itemEl) return;

      if (prod.highlightTime) {
        const { start, end } = prod.highlightTime;
        if (currentTime >= start && currentTime <= end) {
          itemEl.classList.add('active');
        } else {
          itemEl.classList.remove('active');
        }
      }
    });

    this.hotspotElements_.forEach(hsData => {
      const hotspotTime = ShoppableManager.toSeconds(hsData.hotspot.time);
      if (Math.abs(currentTime - hotspotTime) < 0.5) {
        hsData.element.classList.remove('vjs-hidden');
      } else {
        hsData.element.classList.add('vjs-hidden');
      }
    });
  }

  private onEnded() {
    if (this.postPlayOverlay_) {
      this.postPlayOverlay_.classList.remove('vjs-hidden');
      this.player_.trigger('productHoverPost', {});
    }
  }

  private buildPostPlayOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'vjs-shoppable-postplay-overlay vjs-hidden';

    const title = document.createElement('div');
    title.className = 'vjs-shoppable-postplay-title';
    title.textContent = 'Shop the Video';
    overlay.appendChild(title);

    const carousel = document.createElement('div');
    carousel.className = 'vjs-shoppable-postplay-carousel';
    overlay.appendChild(carousel);

    this.shoppable_.products.forEach(prod => {
      const card = document.createElement('div');
      card.className = 'vjs-shoppable-postplay-card';
      card.innerHTML = `<img src="${prod.imageUrl}" alt="${prod.productName}"><span>${prod.productName}</span>`;

      card.addEventListener('mouseenter', () => this.player_.trigger('productHoverPost', { product: prod }));
      card.addEventListener('click', () => {
        this.player_.trigger('productClickPost', { product: prod });
        if (prod.onClick) this.handleInteraction(prod.onClick, prod);
      });
      carousel.appendChild(card);
    });

    const replayBtn = document.createElement('button');
    replayBtn.className = 'vjs-shoppable-replay-btn';
    replayBtn.textContent = 'Replay';
    replayBtn.onclick = () => {
      overlay.classList.add('vjs-hidden');
      this.player_.play();
    };
    overlay.appendChild(replayBtn);

    this.postPlayOverlay_ = overlay;
    this.player_.el().appendChild(overlay);
  }

  private toggleBar() {
    // Stop the initial animation if the user interacts
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
    this.player_.trigger('productBarMax');
    this.resetAutoClose();
  }

  private closeBar(immediate = false) {
    const playerEl = this.player_.el();
    playerEl.classList.remove('shoppable-panel-visible');
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
      this.autoCloseTimeout_ = setTimeout(() => {
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

  private handleInteraction(interaction: InteractionProps, product: ProductProps) {
    const { action, pause, args } = interaction;
    switch (action) {
      case 'seek':
        if (args?.time) {
          this.player_.currentTime(ShoppableManager.toSeconds(args.time));
          if (pause) this.player_.pause();
        }
        break;
      case 'goto':
        if (args?.url) {
          if (pause) this.player_.pause();
          window.open(args.url, '_blank');
        }
        break;
      default:
        break;
    }
  }

  public destroy() {
    const playerEl = this.player_.el();
    playerEl.classList.remove('shoppable-panel-visible');
    if (this.tickHandler_) {
      this.player_.off('timeupdate', this.tickHandler_);
    }
    if (this.endedHandler_) {
      this.player_.off('ended', this.endedHandler_);
    }
    this.barContainer_?.remove();
    // Toggle button is part of the bar now, no need for separate removal
    this.hotspotElements_.forEach(hs => hs.element.remove());
    this.postPlayOverlay_?.remove();
    if (this.autoCloseTimeout_) clearTimeout(this.autoCloseTimeout_);
  }


  private hideToggleButton() {
    if (this.toggleButton_) {
      this.toggleButton_.classList.add('vjs-hidden');
    }
  }

  private showToggleButton() {
    if (this.toggleButton_) {
      this.toggleButton_.classList.remove('vjs-hidden');
    }
  }
}