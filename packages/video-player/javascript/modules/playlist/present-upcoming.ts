// src/modules/playlist/present-upcoming.ts

import videojs from 'video.js';
import type Player from 'video.js/dist/types/player';
import type { PlayerOptions, SourceOptions } from '../../interfaces';
import { preparePosterSrc } from '../../utils';

const Component = videojs.getComponent('Component');

export class PresentUpcoming extends Component {
  private item_?: SourceOptions;
  private playerOptions_: PlayerOptions;
  private thumbnailEl_: HTMLElement;
  private textEl_: HTMLElement;
  private titleEl_: HTMLElement;
  private closeButtonEl_: HTMLElement;


  constructor(player: Player, playerOptions: PlayerOptions) {
    super(player);
    this.playerOptions_ = playerOptions;

    this.thumbnailEl_ = videojs.dom.createEl('div', { className: 'vjs-up-next-thumbnail' }) as HTMLElement;
    this.textEl_ = videojs.dom.createEl('div', { className: 'vjs-up-next-text-2' }, {}, 'Next up:') as HTMLElement;
    this.titleEl_ = videojs.dom.createEl('div', { className: 'vjs-up-next-title' }) as HTMLElement;

    this.closeButtonEl_ = videojs.dom.createEl('div', {
      className: 'vjs-up-next-close-button',
      title: 'Dismiss' // Accessibility: a tooltip for the button
    }) as HTMLElement;

    this.closeButtonEl_.addEventListener('click', (e) => {
      e.stopPropagation(); // Stop the click from bubbling up to the parent div
      this.trigger('dismiss'); // Fire a custom event to notify the manager
    });

    this.el().appendChild(this.thumbnailEl_);
    this.el().appendChild(this.textEl_);
    this.el().appendChild(this.titleEl_);
    this.el().appendChild(this.closeButtonEl_);


    // Start hidden
    this.hide();
  }

  createEl(): HTMLElement {
    const el = videojs.dom.createEl('div', {
      className: 'vjs-present-upcoming'
    }) as HTMLElement;

    // Make it clickable to advance to the next video immediately
    el.addEventListener('click', (e) => {
      // Prevent the close button itself from triggering "playNext"
      if (e.target !== this.closeButtonEl_) {
        (this.player_ as any).imagekitVideoPlayer().getPlaylistManager().playNext();
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
    this.titleEl_.textContent = title;

    try {
      const posterUrl = await preparePosterSrc(item, this.playerOptions_);
      const img = document.createElement('img');
      img.src = posterUrl;
      img.alt = title;
      this.thumbnailEl_.appendChild(img);
    } catch (e) {
      // If poster fails, show a placeholder
      this.thumbnailEl_.classList.add('vjs-playlist-thumbnail-placeholder');
      console.error('Failed to load "Up Next" poster:', e);
    }
  }
}

// @ts-ignore
videojs.registerComponent('PresentUpcoming', PresentUpcoming);