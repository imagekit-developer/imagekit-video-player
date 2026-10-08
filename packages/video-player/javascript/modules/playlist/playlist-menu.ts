// playlist-menu.ts
import videojs from 'video.js';
import type Player from 'video.js/dist/types/player';
import type ComponentType from 'video.js/dist/types/component';
import { PlaylistMenuItem } from './playlist-menu-item';
import { Playlist } from './playlist';
import { IKPlayerOptions } from '../../interfaces';
import { CleanupRegistry } from '../../utils';
import { isEqual, pick } from 'lodash';
import { SOURCE_OPTION_KEYS } from './utils';

const Component = videojs.getComponent('Component') as typeof ComponentType;

interface PlaylistMenuOptions {
  horizontal?: boolean;
  showDescription?: boolean;
  playOnSelect?: boolean;
  className?: string;
}

const addSelectedClass = (el: any) => el.addClass('vjs-selected');
const removeSelectedClass = (el: any) => el.removeClass('vjs-selected');

export class PlaylistMenu extends Component {
  private items: PlaylistMenuItem[] = [];
  // Index of the item that is the playlist's single Tab stop (roving tabindex).
  private tabStopIndex_ = -1;
  private playlist: Playlist;
  private playerOptions: IKPlayerOptions;
  private cleanup_ = new CleanupRegistry();

  constructor(
    player: Player,
    playlist: Playlist,
    options: PlaylistMenuOptions,
    playerOptions: IKPlayerOptions
  ) {
    // Pass `options` into super so Video.js creates `el_` for you:
    super(player, options);

    this.playlist = playlist;
    this.playerOptions = playerOptions;

    // 1) Add orientation classes to the element Video.js already created:
    if (options.horizontal) {
      this.addClass('vjs-playlist-horizontal');
    } else {
      this.addClass('vjs-playlist-vertical');
    }
    if (!videojs.browser.TOUCH_ENABLED) {
      this.addClass('vjs-mouse');
    }

    // 2) Listen for ad events
    this.cleanup_.registerVideoJsListener(player, 'adstart', () => this.addClass('vjs-ad-playing'));
    this.cleanup_.registerVideoJsListener(player, 'adend', () => this.removeClass('vjs-ad-playing'));

    // 3) Listen for playlist events
    this.cleanup_.registerVideoJsListener(player, 'playlistchange', () => {
      this.update();
    });
    this.cleanup_.registerVideoJsListener(player, 'playlistsorted', () => {
      this.update();
    });
    this.cleanup_.registerVideoJsListener(player, 'playlistadd', () => this.update());
    this.cleanup_.registerVideoJsListener(player, 'playlistremove', () => this.update());
    this.cleanup_.registerVideoJsListener(player, 'loadstart', () => {
      this.update();
    });

    this.on('dispose', () => this.empty_());

    // Listbox keyboard model: the list is one Tab stop; arrows / Home / End move
    // between items (WCAG 2.1.1). Enter / Space are handled by each item.
    this.cleanup_.registerEventListener(this.el(), 'keydown', (e: Event) => this.handleListKeyDown_(e as KeyboardEvent));
    // Clicking or tabbing to an item makes it the Tab stop.
    this.cleanup_.registerEventListener(this.el(), 'focusin', (e: Event) => {
      const index = this.indexOfItemEl_(e.target);
      if (index > -1) this.setTabStop_(index);
    });

    // 4) Initial render
    this.update();
  }

  /** Video.js will call this once to build a `<div>` for us. */
  createEl(): HTMLElement {
    const cls = this.options_.className || 'vjs-playlist-menu';
    return videojs.dom.createEl('div', { className: cls }) as HTMLElement;
  }

  /** Render or re-render the playlist UI */
  private update(): void {
    if (!this.el_) return;

    const items = this.playlist.getItems();
    const currentIndex = this.playlist.getCurrentIndex?.() ?? 0;
    // Re-rendering replaces the items; remember which one had focus to restore it.
    const focusedIndex = this.indexOfItemEl_(document.activeElement);

    const contentChanged =
      this.items.length !== items.length ||
      this.items.some((mi, i) => {
        const menuItem = mi.getItem();
        const playlistItem = items[i];
        return !isEqual(
          pick(menuItem, SOURCE_OPTION_KEYS),
          pick(playlistItem, SOURCE_OPTION_KEYS)
        );
      });

    if (contentChanged) {
      this.empty_();

      const listEl = document.createElement('ol');
      listEl.className = 'vjs-playlist-item-list';
      listEl.setAttribute('role', 'listbox');
      listEl.setAttribute('aria-label', this.localize('Playlist'));
      listEl.setAttribute('aria-orientation', this.hasClass('vjs-playlist-horizontal') ? 'horizontal' : 'vertical');
      this.el_.appendChild(listEl);

      this.items = items.map((item, index) => {
        const menuItem = new PlaylistMenuItem(
          this.player_,
          this.playlist,
          {
            item,
            showDescription: this.options_.showDescription,
            playOnSelect: this.options_.playOnSelect,
          },
          this.playerOptions
        );
        listEl.appendChild(menuItem.el_);
        return menuItem;
      });
    }

    this.items.forEach((mi, i) => {
      const thumbnail = mi.el_.querySelector('.vjs-playlist-thumbnail');
      // Announced as "selected": the video that is playing now.
      mi.el_.setAttribute('aria-selected', String(i === currentIndex));
      if (i === currentIndex) {
        addSelectedClass(mi);
        if (thumbnail) {
          videojs.dom.addClass(thumbnail, 'vjs-playlist-now-playing');
        }
      } else {
        removeSelectedClass(mi);
        if (thumbnail) {
          videojs.dom.removeClass(thumbnail, 'vjs-playlist-now-playing');
        }
      }
    });

    if (focusedIndex > -1) {
      this.setTabStop_(focusedIndex);
      if (contentChanged) (this.items[focusedIndex]?.el_ as HTMLElement | undefined)?.focus();
    } else if (contentChanged || this.tabStopIndex_ < 0 || this.tabStopIndex_ >= this.items.length) {
      this.setTabStop_(currentIndex);
    }
  }

  private indexOfItemEl_(target: EventTarget | null): number {
    if (!(target instanceof Element)) return -1;
    const li = target.closest('.vjs-playlist-item');
    return li ? this.items.findIndex(mi => mi.el_ === li) : -1;
  }

  /** Makes item `index` the one Tab stop of the list. */
  private setTabStop_(index: number): void {
    if (!this.items.length) return;
    const clamped = Math.max(0, Math.min(index, this.items.length - 1));
    this.tabStopIndex_ = clamped;
    this.items.forEach((mi, i) => { (mi.el_ as HTMLElement).tabIndex = i === clamped ? 0 : -1; });
  }

  private handleListKeyDown_(e: KeyboardEvent): void {
    const index = this.indexOfItemEl_(e.target);
    if (index < 0) return;
    let next = -1;
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        next = Math.min(index + 1, this.items.length - 1);
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        next = Math.max(index - 1, 0);
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = this.items.length - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    this.setTabStop_(next);
    (this.items[next].el_ as HTMLElement).focus();
  }

  /** Remove all menu items */
  private empty_(): void {
    if (!this.el_) return;
    this.items.forEach(i => i.dispose());
    this.items = [];
    this.el_.innerHTML = '';
  }

  dispose(): void {
    this.cleanup_.dispose();
    super.dispose();
  }
}
videojs.registerComponent('PlaylistMenu', PlaylistMenu as any);
export default PlaylistMenu;