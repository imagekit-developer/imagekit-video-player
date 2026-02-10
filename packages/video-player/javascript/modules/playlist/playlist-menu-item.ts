import videojs from 'video.js';
import type { Player } from '../../interfaces/Player';
import type ComponentType from 'video.js/dist/types/component';
import type { IKPlayerOptions, Transformation } from '../../interfaces';
import { Playlist } from './playlist';
import { preparePosterSrc } from '../../utils';
import { AugmentedSourceOptions } from '../../interfaces/AugementedSourceOptions';

const Component = videojs.getComponent('Component') as typeof ComponentType;

interface PlaylistMenuItemOptions {
  item: AugmentedSourceOptions;
  showDescription?: boolean;
  playOnSelect?: boolean;
  children?: any[];
  className?: string;
  playerOptions?: IKPlayerOptions;
}

const DEFAULT_TRANSFORMATION: Transformation = {
  width: 400,
  aspectRatio: '16-9',
  cropMode: 'pad_resize',
  background: 'black',
}

export class PlaylistMenuItem extends Component {
  private item: AugmentedSourceOptions;
  private spinnerEl!: HTMLElement;
  private thumbnail!: HTMLElement;
  private imgEl?: HTMLImageElement;
  private playOnSelect: boolean;
  private playlist: Playlist
  private playerOptions: IKPlayerOptions;

  constructor(player: Player, playlist: Playlist, options: PlaylistMenuItemOptions, playerOptions: IKPlayerOptions) {
    super(player, options as any);
    this.item = options.item;
    this.playOnSelect = !!options.playOnSelect;
    this.playlist = playlist
    this.playerOptions = playerOptions;

    this.emitTapEvents();
    this.on(['click', 'tap'], this.switchPlaylistItem_);
    this.on('keydown', this.handleKeyDown_);
  }

  private handleKeyDown_(event: KeyboardEvent): void {
    if (event.which === 13 || event.which === 32) {
      this.switchPlaylistItem_();
    }
  }

  private switchPlaylistItem_(): void {
    const list = this.playlist.getItems();
    const idx = list.findIndex(src => src === this.item);
    if (idx > -1) {
      const player = this.player_ as Player;
      const playlistManager = player.imagekitVideoPlayer().getPlaylistManager();
      if (playlistManager) {
        playlistManager.loadPlaylistItem(idx);
      }
      if (this.playOnSelect) {
        this.player_.play();
      }
    }
  }

  private getItem() {
    return this.options_.item;
  }

  private async getThumbnail() {
    const item = this.getItem();
    if (!item) {
      throw new Error('No item provided for thumbnail');
    }
    if (item?.prepared?.playlistThumbnail) {
      return item.prepared.playlistThumbnail;
    }
    if (!item.poster?.transformation) {
      if (!item.poster) {
        item.poster = {};
      }
      item.poster.transformation = [DEFAULT_TRANSFORMATION]

    }
    const player = this.player_ as Player;
    const preparedUrl = await preparePosterSrc(item, player.imagekitVideoPlayer().getPlayerOptions())
    if(!this.item.prepared) {
      this.item.prepared = {};
    }
    this.item.prepared.playlistThumbnail = preparedUrl;
    return preparedUrl;
  }

  createEl(): HTMLElement {
    const li = document.createElement('li');
    li.className = 'vjs-playlist-item';
    li.tabIndex = 0;

    this.thumbnail = document.createElement('div');
    this.thumbnail.className = 'vjs-playlist-thumbnail';
    li.appendChild(this.thumbnail);

    this.spinnerEl = document.createElement('div');
    this.spinnerEl.className = 'vjs-playlist-thumbnail-spinner';
    this.thumbnail.appendChild(this.spinnerEl);

    this.getThumbnail()
      .then((url) => {
      if (!this.el_) return;
      if (this.spinnerEl) this.spinnerEl.remove();

      this.imgEl = document.createElement('img');
      this.imgEl.className = 'vjs-playlist-thumbnail-img';
      this.imgEl.loading = 'lazy';
      this.imgEl.alt = this.options_.item.info?.title || '';
      this.imgEl.onerror = () => {
        if (!this.el_) return;
        if (this.imgEl) {
          this.imgEl.remove();
        }
        this.thumbnail.classList.add('vjs-playlist-thumbnail-placeholder');
      };
      this.imgEl.src = url;
      this.thumbnail.appendChild(this.imgEl);
      })
      .catch((err) => {
      if (!this.el_) return;
      this.player_.log.error(`Failed to load poster for playlist item: ${err.message}`);
      if (this.spinnerEl) this.spinnerEl.remove();
      this.thumbnail.classList.add('vjs-playlist-thumbnail-placeholder');
      });

    const detailsEl = document.createElement('div');
    detailsEl.className = 'vjs-playlist-details';
    li.appendChild(detailsEl);

    const title = this.options_.item.info?.title || this.localize('Untitled Video');
    const titleEl = document.createElement('div');
    titleEl.className = 'vjs-playlist-name';
    titleEl.textContent = title;
    titleEl.title = title;
    detailsEl.appendChild(titleEl);

    if (this.options_.item.info?.description) {
      const descEl = document.createElement('div');
      descEl.className = 'vjs-playlist-description';
      descEl.textContent = this.options_.item.info.description;
      descEl.title = this.options_.item.info.description;
      detailsEl.appendChild(descEl);
    }

    return li;
  }
}

videojs.registerComponent('PlaylistMenuItem', PlaylistMenuItem as any);