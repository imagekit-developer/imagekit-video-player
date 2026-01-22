// src/modules/playlist/present-upcoming.ts

import videojs from 'video.js';
import type Player from 'video.js/dist/types/player';
import type ComponentType from 'video.js/dist/types/component';
import type { IKPlayerOptions, SourceOptions } from '../../interfaces';
import { preparePosterSrc, CleanupRegistry } from '../../utils';
import type { Player as ImageKitPlayer } from '../../interfaces/Player';

const Component = videojs.getComponent('Component') as typeof ComponentType;

export class PresentUpcoming extends Component {
  private item_?: SourceOptions;
  private playerOptions_: IKPlayerOptions;
  private thumbnailEl_: HTMLElement;
  // private textEl_: HTMLElement;
  private titleEl_: HTMLElement;
  private closeButtonEl_: HTMLElement;
  private cleanup_: CleanupRegistry;


  constructor(player: Player, playerOptions: IKPlayerOptions) {
    super(player);
    // Initialize cleanup_ after super() because createEl() may be called during super()
    this.cleanup_ = new CleanupRegistry();
    this.playerOptions_ = playerOptions;

    this.thumbnailEl_ = videojs.dom.createEl('div', { className: 'vjs-up-next-thumbnail' }) as HTMLElement;
    // this.textEl_ = videojs.dom.createEl('div', { className: 'vjs-up-next-text-2' }, {}, 'Next up:') as HTMLElement;
    this.titleEl_ = videojs.dom.createEl('div', { className: 'vjs-up-next-title' }, {}, "Next up") as HTMLElement;

    this.closeButtonEl_ = videojs.dom.createEl('div', {
      className: 'vjs-up-next-close-button',
      title: 'Dismiss' // Accessibility: a tooltip for the button
    }) as HTMLElement;

    this.closeButtonEl_.innerHTML = "&#10005;"

    this.cleanup_.registerEventListener(this.closeButtonEl_, 'click', (e: Event) => {
      e.stopPropagation(); // Stop the click from bubbling up to the parent div
      this.trigger('dismiss'); // Fire a custom event to notify the manager
    });

    this.el().appendChild(this.thumbnailEl_);
    // this.el().appendChild(this.textEl_);
    this.el().appendChild(this.titleEl_);
    this.el().appendChild(this.closeButtonEl_);


    // Start hidden
    this.hide();
  }

  createEl(): HTMLElement {
    const el = videojs.dom.createEl('div', {
      className: 'vjs-present-upcoming'
    }) as HTMLElement;

    // Initialize cleanup_ if not already initialized (createEl may be called before constructor completes)
    if (!this.cleanup_) {
      this.cleanup_ = new CleanupRegistry();
    }

    // Make it clickable to advance to the next video immediately
    this.cleanup_.registerEventListener(el, 'click', (e: Event) => {
      // Prevent the close button itself from triggering "playNext"
      // Note: This handler only executes on click (after construction), so closeButtonEl_ will exist
      if (!this.closeButtonEl_ || e.target !== this.closeButtonEl_) {
        const player = this.player_ as unknown as ImageKitPlayer;
        const playlistManager = player.imagekitVideoPlayer().getPlaylistManager();
        if (playlistManager) {
          playlistManager.playNext();
        }
      }
    });

    return el;
  }

  /**
   * Update the component with the details of the next video.
   * @param item The next playlist item.
   */
  public async update(item: SourceOptions): Promise<void> {
    if (!item || this.item_ === item) {
      return;
    }
    this.item_ = item;

    // Clear previous thumbnail
    this.thumbnailEl_.innerHTML = '';
    const title = item.info?.title || this.localize('Untitled Video');
    this.titleEl_.textContent = `Next up: ${title}`;

    try {
      const posterUrl = await preparePosterSrc(item, this.playerOptions_);
      const img = document.createElement('img');
      img.src = posterUrl;
      img.alt = `Next up: ${title}`;
      this.thumbnailEl_.appendChild(img);
    } catch (e) {
      // If poster fails, show a placeholder
      this.thumbnailEl_.classList.add('vjs-playlist-thumbnail-placeholder');
      console.error('Failed to load "Up Next" poster:', e);
    }
  }

  dispose(): void {
    this.cleanup_.dispose();
    super.dispose();
  }
}

videojs.registerComponent('PresentUpcoming', PresentUpcoming as any);