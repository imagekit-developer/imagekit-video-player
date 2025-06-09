// src/modules/shoppable/shoppable-manager.ts
import videojs from 'video.js';
import type Player from 'video.js/dist/types/player';
import type {
  ShoppableProps,
  ProductProps,
  Hotspot,
  InteractionProps
} from '../../interfaces/Shoppable';

// We’ll dynamically create a “products bar” at the bottom/right
// of the player. Each product in the bar is clickable/hoverable, and
// we’ll also overlay timed hotspots on top of the video. When the
// playhead is between highlightTime.start–highlightTime.end, we
// add a “highlight” style to the corresponding product in the bar.

export class ShoppableManager {
  private player_: Player;
  private shoppable_: ShoppableProps;
  private barContainer_: HTMLDivElement | null = null;
  private hotspotContainers_: HTMLDivElement[] = [];
  private postPlayOverlay_: HTMLDivElement | null = null;
  private tickHandler_: (() => void) | null = null;
  private endedHandler_: (() => void) | null = null;

  constructor(player: Player, shoppable: ShoppableProps) {
    this.player_ = player;
    this.shoppable_ = shoppable;

    // 1) Wait until Video.js has built its DOM (control bar, tech, etc.)
    this.player_.one('play', () => {
        // Now that the control bar exists and metadata is ready, build the bar:
        // this.buildToggleButton();
        this.buildProductBar();
        this.buildHotspots();

        // Start listening to timeupdate for highlights/hotspots:
        this.tickHandler_ = this.onTimeUpdate.bind(this);
        this.player_.on('timeupdate', this.tickHandler_);

        // Build post-play overlay if requested:
        if (this.shoppable_.showPostPlayOverlay) {
          this.buildPostPlayOverlay();
          this.endedHandler_ = this.onEnded.bind(this);
          this.player_.on('ended', this.endedHandler_);
        }

        // Handle startState (“openOnPlay” or “open”):
        if (this.shoppable_.startState === 'openOnPlay') {
          this.player_.one('play', () => this.openBar());
        } else if (this.shoppable_.startState === 'open') {
          this.openBar();
        }
    });
  }
  /**
   * Create the “products bar” that sits alongside (or below) the player.
   * We insert a small <div> with a fixed width (percentage) and a
   * scrollable row of thumbnail images. Each image has hover/click behavior.
   */
  // private buildProductBar() {
  //   const widthPct = this.shoppable_.width ?? 20; // default = 20%
  //   const toggleIcon = this.shoppable_.toggleIconUrl || '';

  //   // Defer measurement until after the browser’s next paint:
  // // requestAnimationFrame(() => {
  //   // Now the control bar has been laid out:
  //   const controlBarEl = this.player_.controlBar.el();
  //   const controlBarHeight = controlBarEl.getBoundingClientRect().height;

  //   console.log('Control bar height:', controlBarHeight);

  //   // Create your “products” div and pin it above the control bar:
    
  //   // 1) Create container DIV
  //   const bar = document.createElement('div');
  //   bar.className = 'vjs-shoppable-products-bar vjs-hidden'; // initially hidden
  //   Object.assign(bar.style, {
  //     position: 'absolute',
  //     top: '0',
  //     right: '0',
  //     bottom: `${controlBarHeight}px`,   // use the freshly‐measured height
  //     width: `${widthPct}%`,                    // e.g. “20%” of the player width
  //     background: 'rgba(0,0,0,0.6)',
  //     display: 'flex',
  //     flexDirection: 'column',
  //     overflowY: 'auto',
  //     zIndex: '999'
  //   });

  //   this.barContainer_ = bar;

  //   // 2) Add a toggle icon (to minimize/maximize the bar)
  //   if (toggleIcon) {
  //     const iconBtn = document.createElement('img');
  //     iconBtn.src = toggleIcon;
  //     iconBtn.className = 'vjs-shoppable-toggle-icon';
  //     Object.assign(iconBtn.style, {
  //       width: '24px',
  //       height: '24px',
  //       cursor: 'pointer',
  //       margin: '8px'
  //     });
  //     iconBtn.addEventListener('click', () => this.toggleBar());
  //     bar.appendChild(iconBtn);
  //   }

  //   // 3) Create a horizontally scrollable container of product thumbnails
  //   const scrollContainer = document.createElement('div');
  //   scrollContainer.className = 'vjs-shoppable-products-scroll';
  //   Object.assign(scrollContainer.style, {
  //     display: 'flex',
  //     flexDirection: 'column',
  //     overflowX: 'hidden',
  //     padding: '8px'
  //   });

  //   // 4) For each product in shoppable_.products, create a thumbnail
  //   this.shoppable_.products.forEach((prod, idx) => {
  //     const thumbWrapper = document.createElement('div');
  //     thumbWrapper.className = 'vjs-shoppable-thumb-wrapper';
  //     Object.assign(thumbWrapper.style, {
  //       position: 'relative',
  //       marginRight: '8px',
  //       cursor: 'pointer'
  //     });

  //     // a) create <img> tag for product.imageUrl
  //     const img = document.createElement('img');
  //     img.src = prod.imageUrl;
  //     img.alt = prod.productName;
  //     img.className = 'vjs-shoppable-thumb-img';
  //     Object.assign(img.style, {
  //       width: '200px',
  //       height: '200px',
  //       objectFit: 'cover',
  //       border: '2px solid transparent'
  //     });
  //     thumbWrapper.appendChild(img);

  //     // b) listen to click / hover on the thumbnail
  //     thumbWrapper.addEventListener('mouseenter', () => {
  //       this.player_.trigger('productHover', { product: prod });
  //       if (prod.onHover) {
  //         this.handleInteraction(prod.onHover, prod);
  //       }
  //     });
  //     thumbWrapper.addEventListener('mouseleave', () => {
  //       // (you could trigger a “productHoverEnd” if you need)
  //     });
  //     thumbWrapper.addEventListener('click', () => {
  //       this.player_.trigger('productClick', { product: prod });
  //       if (prod.onClick) {
  //         this.handleInteraction(prod.onClick, prod);
  //       }
  //     });

  //     // c) store a reference so we can highlight it later
  //     thumbWrapper.setAttribute('data-shoppable-idx', String(idx));
  //     scrollContainer.appendChild(thumbWrapper);
  //   });

  //   bar.appendChild(scrollContainer);
  //   // 5) Finally, attach it to the player container (player.el())
  //   this.player_.el().appendChild(bar);
  // // });
    
  // }

  private buildProductBar() {
    const widthPct = this.shoppable_.width ?? 20; // e.g. 20%
    // 1) Outer wrapper
    const bar = document.createElement('div');
    bar.className = 'cld-spbl-bar'; 
    bar.setAttribute('size', 'lg');
  
    // 2) The sliding inner panel
    const inner = document.createElement('div');
    inner.className = 'cld-spbl-bar-inner';
    // We’ll later toggle “shoppable-panel-visible” on player.el() to slide this in/out
    bar.appendChild(inner);
  
    // 5) Build the toggle button 
    const toggle = document.createElement('a');
    toggle.className = 'cld-spbl-toggle base-color-bg';
    toggle.setAttribute('tabindex', '0');
    toggle.setAttribute('role', 'button');
    toggle.setAttribute('aria-disabled', 'false');
  
    // Placeholder spans (for accessibility/icons):
    const placeholder1 = document.createElement('span');
    placeholder1.className = 'vjs-icon-placeholder';
    placeholder1.setAttribute('aria-hidden', 'true');
  
    const placeholder2 = document.createElement('span');
    placeholder2.className = 'vjs-control-text';
    placeholder2.setAttribute('aria-live', 'polite');
  
    const customIcon = document.createElement('span');
    customIcon.className = 'cld-spbl-toggle-icon cld-spbl-toggle-custom-icon vjs-icon-close';
    customIcon.style.backgroundImage = `url(${this.shoppable_.toggleIconUrl})`;
  
    toggle.appendChild(placeholder1);
    toggle.appendChild(placeholder2);
    toggle.appendChild(customIcon);
  
    toggle.addEventListener('click', () => this.toggleBar());
    inner.appendChild(toggle);
  
    // 6) The actual product‐panel container
    const panel = document.createElement('div');
    panel.className = 'cld-spbl-panel base-color-bg';
    inner.appendChild(panel);
  
    // 7) For each product, append <a class="cld-spbl-item">…</a>
    this.shoppable_.products.forEach((prod, idx) => {
      const item = document.createElement('a');
      item.className = 'cld-spbl-item base-color-bg accent-color-text';
      item.setAttribute('tabindex', '0');
      item.setAttribute('href', '#');
      item.setAttribute('role', 'button');
      item.setAttribute('data-product-id', prod.productId);
      item.setAttribute('data-product-name', prod.productName);
  
      // If you want Cloudinary’s “data-hover-action” / “data-click-action” attributes:
      if (prod.onHover) {
        item.setAttribute('data-hover-action', prod.onHover.action);
      }
      if (prod.onClick) {
        item.setAttribute('data-click-action', prod.onClick.action);
        if (prod.onClick.args?.time) {
          item.setAttribute('data-seek', prod.onClick.args.time);
          if (prod.onClick.pause !== undefined) {
            item.setAttribute('data-pause', String(prod.onClick.pause));
          }
        }
        if (prod.onClick.args?.url) {
          item.setAttribute('data-goto-url', prod.onClick.args.url);
          if (prod.onClick.pause !== undefined) {
            item.setAttribute('data-pause', String(prod.onClick.pause));
          }
        }
      }
  
      // Accessibility placeholder spans:
      const ph1 = document.createElement('span');
      ph1.className = 'vjs-icon-placeholder';
      ph1.setAttribute('aria-hidden', 'true');
  
      const ph2 = document.createElement('span');
      ph2.className = 'vjs-control-text';
      ph2.setAttribute('aria-live', 'polite');
  
      item.appendChild(ph1);
      item.appendChild(ph2);
  
      // If you want the “hover overlay label” (Cloudinary does this only if
      // they have data-hover-action="overlay"):
      if (prod.onHover?.action === 'overlay') {
        const overlaySpan = document.createElement('span');
        overlaySpan.className = 'cld-spbl-overlay text-color-semi-bg base-color-text';
        overlaySpan.setAttribute('title', `Click to see this product in the video`);
        const overlayText = document.createElement('span');
        overlayText.className = 'cld-spbl-overlay-text base-color-text';
        overlayText.innerText = `Click to see this product in the video`;
        overlaySpan.appendChild(overlayText);
        item.appendChild(overlaySpan);
      }
  
      // The thumbnail image
      const img = document.createElement('img');
      img.className = 'cld-spbl-img';
      img.setAttribute('tabindex', '0');
      img.setAttribute('role', 'button');
      img.src = prod.imageUrl;
      img.alt = prod.productName;
      item.appendChild(img);
  
      // The “info” (title) below each thumbnail
      const info = document.createElement('div');
      info.className = 'cld-spbl-item-info base-color-semi-bg text-color-text';
      const title = document.createElement('span');
      title.className = 'cld-spbl-item-title';
      title.innerText = prod.productName;
      info.appendChild(title);
      item.appendChild(info);
  
      // Hover & click event wiring:
      item.addEventListener('mouseenter', () => {
        this.player_.trigger('productHover', { product: prod });
        if (prod.onHover) {
          this.handleInteraction(prod.onHover, prod);
        }
      });
      item.addEventListener('click', (evt) => {
        evt.preventDefault();
        this.player_.trigger('productClick', { product: prod });
        if (prod.onClick) {
          this.handleInteraction(prod.onClick, prod);
        }
      });
  
      panel.appendChild(item);
    });
  
    // 8) Append the bar into the player’s root element:
    this.player_.el().appendChild(bar);
    this.barContainer_ = bar;
  
    // Ensure we start “hidden”:
    this.player_.el().classList.add('shoppable-panel-hidden');
    console.log('Shoppable bar built with width:', widthPct, '%');
  }
  

  private buildToggleButton() {
    const toggleIcon = this.shoppable_.toggleIconUrl || 'https://ik.imagekit.io/zuqlyov9d/svgviewer-output%20(1).svg?updatedAt=1749190341946';
      const iconBtn = document.createElement('div');
      iconBtn.className = 'vjs-shoppable-toggle-icon';
      Object.assign(iconBtn.style, {
        backgroundImage: `url(${toggleIcon})`,
        position: 'absolute',
        top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    backgroundSize: "75%",
        background: 'white',
        color: '#fff',
        border: 'none',
        padding: '8px',
        cursor: 'pointer',
        zIndex: '1000',
        width: '24px',
        height: '24px',
      });
      iconBtn.addEventListener('click', () => this.toggleBar());
      this.player_.el().appendChild(iconBtn);
  }

  /** Show/hide the entire product bar */
  private toggleBar() {
    if (!this.barContainer_) return;
    if (this.barContainer_.classList.contains('vjs-hidden')) {
      this.openBar();
    } else {
      this.closeBar();
    }
  }

  // private openBar() {
  //   if (!this.barContainer_) return;
  //   this.barContainer_.classList.remove('vjs-hidden');
  //   this.player_.trigger('productBarMax');
  // }

  // private closeBar() {
  //   if (!this.barContainer_) return;
  //   this.barContainer_.classList.add('vjs-hidden');
  //   this.player_.trigger('productBarMin');
  // }

  private openBar() {
    if (!this.barContainer_) return;
    this.barContainer_.classList.remove('vjs-hidden');
    // Add the “visible” state so .cld-spbl-bar-inner slides left
    this.player_.el().classList.add('shoppable-panel-visible');
    this.player_.el().classList.remove('shoppable-panel-hidden');
    this.player_.trigger('productBarMax');
  }
  
  private closeBar() {
    if (!this.barContainer_) return;
    // Slide it back out:
    this.player_.el().classList.add('shoppable-panel-hidden');
    this.player_.el().classList.remove('shoppable-panel-visible');
    this.player_.trigger('productBarMin');
    // Optionally hide altogether after the transition:
    setTimeout(() => this.barContainer_?.classList.add('vjs-hidden'), 300);
  }
  

  /**
   * Build all “hotspot” elements in the video at their (x%, y%) positions,
   * but keep them hidden initially. When the playhead is between highlightTime.start–end,
   * we show the corresponding hotspot div.
   */
  private buildHotspots() {
    this.shoppable_.products.forEach((prod, idx) => {
      if (!prod.hotspots) return;
      prod.hotspots.forEach((hs: Hotspot) => {
        const hotspotDiv = document.createElement('div');
        hotspotDiv.className = `vjs-shoppable-hotspot vjs-hidden`;
        Object.assign(hotspotDiv.style, {
          position: 'absolute',
          left: hs.x,
          top: hs.y,
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.8)',
          cursor: 'pointer',
          transform: 'translate(-50%, -50%)',
          zIndex: '998'
        });

        // Tooltip (hidden by default)
        const tooltip = document.createElement('div');
        tooltip.className = 'vjs-shoppable-hotspot-tooltip vjs-hidden';
        tooltip.innerText = prod.productName;
        Object.assign(tooltip.style, {
          position: 'absolute',
          whiteSpace: 'nowrap',
          background: 'rgba(0,0,0,0.7)',
          color: '#fff',
          fontSize: '12px',
          padding: '4px 6px',
          borderRadius: '4px',
          transform: 'translate(-50%, -100%)',
          top: '-8px',
          left: '50%'
        });
        hotspotDiv.appendChild(tooltip);

        // Show tooltip on hover
        hotspotDiv.addEventListener('mouseenter', () => {
          tooltip.classList.remove('vjs-hidden');
          this.player_.trigger('productHover', { product: prod });
          if (prod.onHover) {
            this.handleInteraction(prod.onHover, prod);
          }
        });
        hotspotDiv.addEventListener('mouseleave', () => {
          tooltip.classList.add('vjs-hidden');
        });

        // On click: maybe seek / goto / switch?
        hotspotDiv.addEventListener('click', () => {
          this.player_.trigger('productClick', { product: prod });
          if (prod.onClick) {
            this.handleInteraction(prod.onClick, prod);
          }
        });

        // Store a reference, but append to .vjs-tech (so it sits on top of the video)
        this.player_.el().querySelector('.vjs-tech')?.appendChild(hotspotDiv);
        // Keep it hidden until its time
        this.hotspotContainers_.push(hotspotDiv);
      });
    });
  }

  /**
   * Called on every `timeupdate`. We look at currentTime, then:
   *  • Highlight the correct product thumbnail if currentTime ∈ [start, end]
   *  • Show or hide any matching hotspot(s) whose `time` matches
   */
  private onTimeUpdate() {
    const t = this.player_.currentTime();
    this.shoppable_.products.forEach((prod, idx) => {
      // 1) Handle highlight in the products bar
      const thumbWrapper = this.barContainer_?.querySelector(
        `[data-shoppable-idx="${idx}"] img`
      ) as HTMLImageElement | null;

      if (prod.highlightTime) {
        const { start, end } = prod.highlightTime;
        if (t >= start && t <= end) {
          if (thumbWrapper) {
            thumbWrapper.style.border = '2px solid #FFD700';
          }
        } else {
          if (thumbWrapper) {
            thumbWrapper.style.border = '2px solid transparent';
          }
        }
      }

      // 2) Handle timed “hotspots” (hover markers on video)
      // Each product can have multiple `prod.hotspots`, but each hotspot
      // only appears at a specific `time: "00:02"` (we convert to seconds).
      // If currentTime ≈ that time, unhide that hotspot; else hide it. 
      if (prod.hotspots) {
        prod.hotspots.forEach((hs: Hotspot, hotspotIndex: number) => {
          // Convert “00:02” to seconds once:
          const hsTimeInSec = ShoppableManager.toSeconds(hs.time);
          const EPS = 0.25; // show hotspot for a 250ms window
          // Find the correct DOM node in this.hotspotContainers_.
          // We appended in the same order as prod.hotspots above,
          // so index = sum of previous product.hotspots.length + hotspotIndex.
          const globalIdx =
            this.shoppable_.products
              .slice(0, idx)
              .reduce((sum, p) => sum + (p.hotspots?.length || 0), 0) + hotspotIndex;

          const hotspotDiv = this.hotspotContainers_[globalIdx];
          if (!hotspotDiv) return;

          if (Math.abs(t - hsTimeInSec) < EPS) {
            hotspotDiv.classList.remove('vjs-hidden');
          } else {
            hotspotDiv.classList.add('vjs-hidden');
          }
        });
      }
    });
  }

  /** When video ends, show a small post‐play overlay carousel */
  private onEnded() {
    if (!this.postPlayOverlay_) return;
    this.postPlayOverlay_.classList.remove('vjs-hidden');
    this.player_.trigger('productHoverPost', {});
    // (If you want, each post‐play thumbnail can fire productClickPost, etc.)
  }

  /** Build the HTML for the post‐play overlay */
  private buildPostPlayOverlay() {
    if (!this.shoppable_.showPostPlayOverlay) return;
    const overlay = document.createElement('div');
    overlay.className = 'vjs-shoppable-postplay-overlay vjs-hidden';
    Object.assign(overlay.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      right: '0',
      bottom: '0',
      background: 'rgba(0,0,0,0.7)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: '1000'
    });

    // Inside, we’ll show a row of product images
    const carousel = document.createElement('div');
    carousel.className = 'vjs-shoppable-postplay-carousel';
    Object.assign(carousel.style, {
      display: 'flex',
      flexDirection: 'row',
      gap: '16px'
    });

    this.shoppable_.products.forEach(prod => {
      const card = document.createElement('div');
      card.className = 'vjs-shoppable-postplay-card';
      Object.assign(card.style, {
        width: '120px',
        cursor: 'pointer'
      });

      const img = document.createElement('img');
      img.src = prod.imageUrl;
      img.alt = prod.productName;
      Object.assign(img.style, {
        width: '100%',
        height: 'auto',
        objectFit: 'cover',
        borderRadius: '8px'
      });

      const label = document.createElement('div');
      label.innerText = prod.productName;
      Object.assign(label.style, {
        color: '#fff',
        textAlign: 'center',
        marginTop: '4px',
        fontSize: '14px'
      });

      card.appendChild(img);
      card.appendChild(label);
      card.addEventListener('click', () => {
        this.player_.trigger('productClickPost', { product: prod });
        if (prod.onClick) {
          this.handleInteraction(prod.onClick, prod);
        }
      });

      carousel.appendChild(card);
    });

    // A small “close” button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'vjs-shoppable-postplay-close';
    closeBtn.innerHTML = '&#10005;'; // ×
    Object.assign(closeBtn.style, {
      position: 'absolute',
      top: '16px',
      right: '16px',
      background: 'transparent',
      border: 'none',
      color: '#fff',
      fontSize: '24px',
      cursor: 'pointer'
    });
    closeBtn.addEventListener('click', () => {
      overlay.classList.add('vjs-hidden');
    });

    overlay.appendChild(closeBtn);
    overlay.appendChild(carousel);
    this.postPlayOverlay_ = overlay;
    this.player_.el().appendChild(overlay);
  }

  /**
   * Convert “mm:ss” or “hh:mm:ss” → seconds
   */
  private static toSeconds(time: string): number {
    const parts = time.split(':').map((p) => parseFloat(p));
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    } else {
      return parseFloat(time);
    }
  }

  /**
   * Handle “seek” / “goto” / “switch” / “overlay” actions. Whenever a spot is clicked/hovered,
   * we examine `action` and `args` from the interface and carry out the required behavior.
   */
  private handleInteraction(interaction: InteractionProps, product: ProductProps) {
    const { action, pause, args } = interaction;

    switch (action) {
      case 'overlay':
        // Just show a small alert or pause
        // You could also show a custom overlay inside the player
        if (typeof pause === 'number') {
          this.player_.pause();
          setTimeout(() => this.player_.play(), pause * 1000);
        }
        break;

      case 'seek':
        // Pause if requested, then seek the player to args.time
        if (args?.time) {
          const seekTo = ShoppableManager.toSeconds(args.time);
          this.player_.currentTime(seekTo);
          if (pause === true || typeof pause === 'number') {
            this.player_.pause();
          }
        }
        break;

      case 'goto':
        // Pause if requested, then navigate browser to args.url
        if (args?.url) {
          if (pause) {
            this.player_.pause();
          }
          window.open(args.url, '_blank');
        }
        break;

      case 'switch':
        // Swap out the thumbnail in the bar or hotspot to args.url
        if (args?.url) {
          // Find all <img> elements where prod.productId matches:
          // We gave each thumbWrapper a data-shoppable-idx, so:
          this.barContainer_?.querySelectorAll(`div[data-shoppable-idx] img`)
            .forEach((imgEl: Element) => {
              const idx = Number((imgEl.parentElement as HTMLElement)?.getAttribute('data-shoppable-idx'));
              if (this.shoppable_.products[idx].productId === product.productId) {
                (imgEl as HTMLImageElement).src = args.url;
              }
            });
        }
        break;

      default:
        break;
    }
  }

  /** Tear down everything (called when source changes or plugin is destroyed) */
  public destroy() {
    if (this.tickHandler_) {
      this.player_.off('timeupdate', this.tickHandler_);
      this.tickHandler_ = null;
    }
    if (this.endedHandler_) {
      this.player_.off('ended', this.endedHandler_);
      this.endedHandler_ = null;
    }
    // Remove DOM elements
    this.barContainer_?.remove();
    this.hotspotContainers_.forEach((div) => div.remove());
    this.postPlayOverlay_?.remove();
  }
}