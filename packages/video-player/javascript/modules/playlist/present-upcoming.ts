// src/modules/playlist/present-upcoming.ts

import videojs from 'video.js';
import type Player from 'video.js/dist/types/player';
import type ComponentType from 'video.js/dist/types/component';
import type { IKPlayerOptions, SourceOptions } from '../../interfaces';
import { preparePosterSrc, CleanupRegistry } from '../../utils';
import type { Player as ImageKitPlayer } from '../../interfaces/Player';
import { announce } from '../a11y/announcer';

const isActivationKey = (event: KeyboardEvent) => event.key === 'Enter' || event.key === ' ';

const Component = videojs.getComponent('Component') as typeof ComponentType;

export class PresentUpcoming extends Component {
  private item_?: SourceOptions;
  private playerOptions_: IKPlayerOptions;
  private thumbnailEl_: HTMLElement;
  // private textEl_: HTMLElement;
  private titleEl_: HTMLElement;
  private closeButtonEl_: HTMLElement;
  private cleanup_: CleanupRegistry;
  private title_ = '';


  constructor(player: Player, playerOptions: IKPlayerOptions) {
    super(player);
    // Initialize cleanup_ after super() because createEl() may be called during super()
    this.cleanup_ = new CleanupRegistry();
    this.playerOptions_ = playerOptions;

    this.thumbnailEl_ = videojs.dom.createEl('div', { className: 'vjs-up-next-thumbnail' }) as HTMLElement;
    // this.textEl_ = videojs.dom.createEl('div', { className: 'vjs-up-next-text-2' }, {}, 'Next up:') as HTMLElement;
    this.titleEl_ = videojs.dom.createEl('div', { className: 'vjs-up-next-title' }, {}, this.localize('Next up')) as HTMLElement;
    this.titleEl_.id = `${player.id()}-up-next-title`;

    this.closeButtonEl_ = videojs.dom.createEl('div', {
      className: 'vjs-up-next-close-button',
      title: this.localize('Dismiss') // Accessibility: a tooltip for the button
    }) as HTMLElement;

    this.closeButtonEl_.innerHTML = "&#10005;"

    // The card is a group: the thumbnail is the "play next" button (named by the
    // visible title it sits under) and the ✕ is a separate dismiss button.
    this.el().setAttribute('role', 'group');
    this.el().setAttribute('aria-label', this.localize('Up next'));
    this.thumbnailEl_.setAttribute('role', 'button');
    this.thumbnailEl_.setAttribute('tabindex', '0');
    this.thumbnailEl_.setAttribute('aria-labelledby', this.titleEl_.id);
    this.closeButtonEl_.setAttribute('role', 'button');
    this.closeButtonEl_.setAttribute('tabindex', '0');
    this.closeButtonEl_.setAttribute('aria-label', this.localize('Dismiss'));

    this.cleanup_.registerEventListener(this.closeButtonEl_, 'click', (e: Event) => {
      e.stopPropagation(); // Stop the click from bubbling up to the parent div
      this.trigger('dismiss'); // Fire a custom event to notify the manager
    });
    this.cleanup_.registerEventListener(this.closeButtonEl_, 'keydown', (e: Event) => {
      if (!isActivationKey(e as KeyboardEvent)) return;
      e.preventDefault();
      e.stopPropagation();
      this.trigger('dismiss');
    });
    this.cleanup_.registerEventListener(this.thumbnailEl_, 'keydown', (e: Event) => {
      if (!isActivationKey(e as KeyboardEvent)) return;
      e.preventDefault();
      e.stopPropagation();
      this.playNext_();
    });
    // Escape anywhere in the card dismisses it.
    this.cleanup_.registerEventListener(this.el(), 'keydown', (e: Event) => {
      if ((e as KeyboardEvent).key !== 'Escape') return;
      e.stopPropagation();
      this.trigger('dismiss');
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
        this.playNext_();
      }
    });

    return el;
  }

  private playNext_() {
    const player = this.player_ as unknown as ImageKitPlayer;
    const playlistManager = player.imagekitVideoPlayer().getPlaylistManager();
    if (playlistManager) {
      playlistManager.playNext();
    }
  }

  /** Shows the card for `item` and announces it to screen readers. */
  public present(item: SourceOptions): void {
    void this.update(item);
    this.show();
    announce(this.player_ as unknown as Player, this.localize('Next up: {1}', [this.title_]));
  }

  /**
   * Hides the card. If it had keyboard focus, focus moves to the play control,
   * or to the player root when the control bar is hidden (e.g. a new source is
   * loading), so it isn't lost on a hidden element.
   */
  hide(): void {
    const hadFocus = !!this.el_ && this.el().contains(document.activeElement);
    super.hide();
    if (!hadFocus) return;
    const playToggle = (this.player_ as any).getChild('ControlBar')?.getChild('PlayToggle')?.el() as HTMLElement | undefined;
    if (playToggle && playToggle.offsetParent !== null) {
      playToggle.focus();
    } else {
      (this.player_.el() as HTMLElement).focus();
    }
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
    this.title_ = title;
    this.titleEl_.textContent = this.localize('Next up: {1}', [title]);

    try {
      const posterUrl = await preparePosterSrc(item, this.playerOptions_);
      const img = document.createElement('img');
      img.src = posterUrl;
      // Decorative: the title right below already names the "play next" button.
      img.alt = '';
      this.thumbnailEl_.appendChild(img);
    } catch (e) {
      this.thumbnailEl_.classList.add('vjs-playlist-thumbnail-placeholder');
      this.player_.log.error('Failed to load "Up Next" poster:', e);
    }
  }

  dispose(): void {
    this.cleanup_.dispose();
    super.dispose();
  }
}

videojs.registerComponent('PresentUpcoming', PresentUpcoming as any);