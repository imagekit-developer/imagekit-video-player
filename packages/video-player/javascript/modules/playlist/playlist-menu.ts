// playlist-menu.ts
import videojs from 'video.js';
import type Player from 'video.js/dist/types/player';
import { PlaylistMenuItem } from './playlist-menu-item';
import { Playlist } from './playlist';
import { PlayerOptions } from '../../interfaces';

const Component = videojs.getComponent('Component');

interface PlaylistMenuOptions {
  horizontal?: boolean;
  showDescription?: boolean;
  playOnSelect?: boolean;
  supportsCssPointerEvents?: boolean;
  className?: string;
}

const addSelectedClass = (el: any) => el.addClass('vjs-selected');
const removeSelectedClass = (el: any) => el.removeClass('vjs-selected');
const upNext = (el: any) => el.addClass('vjs-up-next');
const notUpNext = (el: any) => el.removeClass('vjs-up-next');

export class PlaylistMenu extends Component {
  private items: PlaylistMenuItem[] = [];
  private playlist: Playlist;
  private playerOptions: PlayerOptions;

  constructor(
    player: Player,
    playlist: Playlist,
    options: PlaylistMenuOptions,
    playerOptions: PlayerOptions
  ) {
    // Pass `options` into super so Video.js creates `el_` for you:
    super(player, options);

    this.playlist = playlist;
    this.playerOptions = playerOptions;

    // 1) Add orientation/pointer‐events classes to the element Video.js already created:
    if (options.horizontal) {
      this.addClass('vjs-playlist-horizontal');
    } else {
      this.addClass('vjs-playlist-vertical');
    }
    if (options.supportsCssPointerEvents) {
      this.addClass('vjs-csspointerevents');
    }
    if (!videojs.browser.TOUCH_ENABLED) {
      this.addClass('vjs-mouse');
    }

    // 2) Listen for ad events
    player.on('adstart', () => this.addClass('vjs-ad-playing'));
    player.on('adend',   () => this.removeClass('vjs-ad-playing'));

    // 3) Listen for playlist events
    player.on(['playlistchange', 'playlistsorted'], () => this.update());
    player.on('playlistadd',    () => this.update());
    player.on('playlistremove', () => this.update());
    player.on('loadstart',      () => this.update());

    this.on('dispose', () => this.empty_());

    // 4) Initial render
    this.update();
  }

  /** Video.js will call this once to build a `<div>` for us. */
  createEl(): HTMLElement {
    const cls = this.options_.className || 'vjs-playlist-menu';
    // @ts-ignore
    return videojs.dom.createEl('div', { className: cls });
  }

  /** Render or re-render the playlist UI */
  private update(): void {
    // Guard: if el_ doesn’t exist yet, skip
    if (!this.el_) return;

    this.empty_();

    const items = this.playlist.getItems();
    const listEl = document.createElement('ol');
    listEl.className = 'vjs-playlist-item-list';
    this.el_.appendChild(listEl);

    this.items = items.map((item, index) => {
      const menuItem = new PlaylistMenuItem(
        this.player_,
        this.playlist,
        {
          item,
          showDescription: this.options_.showDescription,
          playOnSelect:    this.options_.playOnSelect,
        },
        this.playerOptions
      );
      listEl.appendChild(menuItem.el_);
      return menuItem;
    });

    // Highlight current and up-next
    const current = this.playlist.getCurrentIndex?.() ?? 0;
    this.items.forEach((mi, i) => {
      if (i === current) {
        addSelectedClass(mi);
        videojs.dom.addClass(
          mi.el_.querySelector('.vjs-playlist-thumbnail')!,
          'vjs-playlist-now-playing'
        );
      } else {
        removeSelectedClass(mi);
      }
      if (i === current + 1) {
        upNext(mi);
      } else {
        notUpNext(mi);
      }
    });
  }

  /** Remove all menu items */
  private empty_(): void {
    if (!this.el_) return;
    this.items.forEach(i => i.dispose());
    this.items = [];
    this.el_.innerHTML = '';
  }
}
// @ts-ignore
videojs.registerComponent('PlaylistMenu', PlaylistMenu);
export default PlaylistMenu;