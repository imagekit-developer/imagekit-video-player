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
    this.item.prepared.playlistThumbnail = preparedUrl; // Store the prepared URL in the item
    return preparedUrl;
  }

  // createEl(): HTMLElement {
  //   const li = document.createElement('li');
  //   li.className = 'vjs-playlist-item';
  //   li.tabIndex = 0;

  //   // Thumbnail

  //   // 1) create thumbnail container
  //   this.thumbnail = document.createElement('div');
  //   this.thumbnail.className = 'vjs-playlist-thumbnail';
  //   li.appendChild(this.thumbnail);

  //   // 2) spinner
  //   this.spinnerEl = document.createElement('div');
  //   this.spinnerEl.className = 'vjs-playlist-thumbnail-spinner';
  //   // you can style this in your SCSS to show a CSS spinner
  //   this.thumbnail.appendChild(this.spinnerEl);


  //   this.getThumbnail()
  //     // FIX: Use an arrow function to preserve `this` context
  //     .then((url) => {
  //       if (!this.el_) {
  //         return;
  //       }

  //       if (this.spinnerEl) {
  //         this.spinnerEl.remove();
  //       }

  //       this.imgEl = document.createElement('img');
  //       this.imgEl.className = 'vjs-playlist-thumbnail-img';
  //       this.imgEl.loading = 'lazy';
  //       this.imgEl.src = url;
  //       this.imgEl.alt = this.options_.item.info?.title || '';
  //       this.thumbnail.appendChild(this.imgEl); // `this.thumbnail` is now defined
  //       this.thumbnail.style.backgroundImage = `url('${url}')`;
  //     })
  //     // FIX: Use an arrow function to preserve `this` context
  //     .catch((err) => {
  //       if (!this.el_) {
  //         return;
  //       }
  //       this.player_.error({
  //         message: `Failed to load poster for playlist item: ${err.message}`,
  //         cause: err,
  //       });
  //       if (this.spinnerEl) {
  //         this.spinnerEl.remove();
  //       }
  //       // `this.thumbnail` is now defined
  //       this.thumbnail.classList.add('vjs-playlist-thumbnail-placeholder');
  //     });

  //   // Now playing
  //   const nowPlayingEl = document.createElement('span');
  //   const nowPlayingText = this.localize('Now Playing');

  //   nowPlayingEl.className = 'vjs-playlist-now-playing-text';
  //   nowPlayingEl.appendChild(document.createTextNode(nowPlayingText));
  //   nowPlayingEl.setAttribute('title', nowPlayingText);
  //   this.thumbnail.appendChild(nowPlayingEl);

  //   // Title container contains title and "up next"
  //   const titleContainerEl = document.createElement('div');
  //   titleContainerEl.className = 'vjs-playlist-title-container';
  //   this.thumbnail.appendChild(titleContainerEl);


  //   // Up next
  //   const upNextEl = document.createElement('span');
  //   const upNextText = this.localize('Next up');
  //   upNextEl.className = 'vjs-up-next-text';
  //   upNextEl.appendChild(document.createTextNode(upNextText));
  //   upNextEl.setAttribute('title', upNextText);
  //   this.thumbnail.appendChild(upNextEl);

  //   // Title and description
  //   const title = this.options_.item.info?.title || this.localize('Untitled Video');
  //   const titleEl = document.createElement('cite');
  //   titleEl.className = 'vjs-playlist-name';
  //   titleEl.textContent = title;
  //   titleEl.title = title;
  //   titleContainerEl.appendChild(titleEl);



  //   if (this.options_.showDescription && this.options_.item.info?.description) {
  //     const descEl = document.createElement('div');
  //     descEl.className = 'vjs-playlist-description';
  //     descEl.textContent = this.options_.item.info.description;
  //     descEl.title = this.options_.item.info.description;
  //     titleContainerEl.appendChild(descEl);
  //   }

  //   return li;
  // }
  // src/modules/playlist/playlist-menu-item.ts

// ...

 createEl(): HTMLElement {
  const li = document.createElement('li');
  li.className = 'vjs-playlist-item';
  li.tabIndex = 0;

  // --- NEW STRUCTURE ---

  // 1. Thumbnail Container (for image and overlays)
  this.thumbnail = document.createElement('div');
  this.thumbnail.className = 'vjs-playlist-thumbnail';
  li.appendChild(this.thumbnail);

  // Spinner remains inside the thumbnail container
  this.spinnerEl = document.createElement('div');
  this.spinnerEl.className = 'vjs-playlist-thumbnail-spinner';
  this.thumbnail.appendChild(this.spinnerEl);

  // Async thumbnail loading logic (remains the same)
  this.getThumbnail()
    .then((url) => {
      if (!this.el_) return;
      if (this.spinnerEl) this.spinnerEl.remove();

      this.imgEl = document.createElement('img');
      this.imgEl.className = 'vjs-playlist-thumbnail-img';
      this.imgEl.loading = 'lazy';
      this.imgEl.src = url;
      this.imgEl.alt = this.options_.item.info?.title || '';
      this.thumbnail.appendChild(this.imgEl);
    })
    .catch((err) => {
      if (!this.el_) return;
      this.player_.error({
        message: `Failed to load poster for playlist item: ${err.message}`,
        cause: err,
      });
      if (this.spinnerEl) this.spinnerEl.remove();
      this.thumbnail.classList.add('vjs-playlist-thumbnail-placeholder');
    });

  // 2. Details Container (for title and description)
  const detailsEl = document.createElement('div');
  detailsEl.className = 'vjs-playlist-details';
  li.appendChild(detailsEl);

  // Title
  const title = this.options_.item.info?.title || this.localize('Untitled Video');
  const titleEl = document.createElement('div');
  titleEl.className = 'vjs-playlist-name';
  titleEl.textContent = title;
  titleEl.title = title;
  detailsEl.appendChild(titleEl);

  // Description (if available)
  if (true) {
    const descEl = document.createElement('div');
    descEl.className = 'vjs-playlist-description';
    descEl.textContent = "some description";
    descEl.title = "some description";
    detailsEl.appendChild(descEl);
  }

  // --- END NEW STRUCTURE ---

  // NOTE: The old "Now Playing" and "Up Next" text elements are intentionally removed.
  // Their styling will be handled by CSS on the `li` and thumbnail elements.

  return li;
}

// ...
}

videojs.registerComponent('PlaylistMenuItem', PlaylistMenuItem as any);