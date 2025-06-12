import videojs from 'video.js';
import type Player from 'video.js/dist/types/player';
import type { PlayerOptions, SourceOptions } from '../../interfaces';
import { Playlist } from './playlist';
import { preparePosterSrc } from '../../utils';


const Component = videojs.getComponent('Component');

function createThumbnail(poster?: string) {
  const picture = document.createElement('picture');
  picture.className = 'vjs-playlist-thumbnail';

  if (!poster) {
    picture.classList.add('vjs-playlist-thumbnail-placeholder');
    return picture;
  }

  const img = document.createElement('img');
  img.loading = 'lazy';
  img.src = poster;
  img.alt = '';
  picture.appendChild(img);

  return picture;
}

interface PlaylistMenuItemOptions {
  item: SourceOptions;
  showDescription?: boolean;
  playOnSelect?: boolean;
  children?: any[];
  className?: string;
  playerOptions?: PlayerOptions;
}

export class PlaylistMenuItem extends Component {
  private item: SourceOptions;
  private spinnerEl!: HTMLElement;
  private thumbnail!: HTMLElement;
  private imgEl?: HTMLImageElement;
  private playOnSelect: boolean;
  private playlist: Playlist
  private playerOptions: PlayerOptions;

  constructor(player: Player, playlist: Playlist, options: PlaylistMenuItemOptions, playerOptions: PlayerOptions) {
    // @ts-ignore
    super(player, { ...options, playerOptions: playerOptions });
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
      (this.player_ as any).imagekitVideoPlayer().getPlaylistManager().loadPlaylistItem(idx);
      if (this.playOnSelect) {
        this.player_.play();
      }
    }
  }

  createEl(): HTMLElement {
    const li = document.createElement('li');
    li.className = 'vjs-playlist-item';
    li.tabIndex = 0;

    // Thumbnail
    // console.log("createEl playlistMenuItems", this)
    // this.thumbnail = createThumbnail(this.options_.item.poster?.src);
    // li.appendChild(this.thumbnail);
       // 1) create thumbnail container
       this.thumbnail = document.createElement('div');
       this.thumbnail.className = 'vjs-playlist-thumbnail';
       li.appendChild(this.thumbnail);
   
       // 2) spinner
       this.spinnerEl = document.createElement('div');
       this.spinnerEl.className = 'vjs-playlist-thumbnail-spinner'; 
       // you can style this in your SCSS to show a CSS spinner
       this.thumbnail.appendChild(this.spinnerEl);
   
       // 3) kick off async poster load
       preparePosterSrc(this.options_.item, this.options_.playerOptions)
         .then(url => {
           // remove spinner
           if (this.spinnerEl) {
            this.spinnerEl.remove();
          }
   
           // create & insert image
           this.imgEl = document.createElement('img');
           this.imgEl.loading = 'lazy';
           this.imgEl.src     = url;
           this.imgEl.alt     = this.options_.item.info?.title || '';
           this.thumbnail.appendChild(this.imgEl);
         })
         .catch(err => {
          this.player_.error({
            message: `Failed to load poster for playlist item: ${err.message}`,
            cause: err
          });
           // poster generation failed: remove spinner and show placeholder
           if (this.spinnerEl) {
            this.spinnerEl.remove();
          }
           this.thumbnail.classList.add('vjs-playlist-thumbnail-placeholder');
         });

    // Now playing
    const nowPlayingEl = document.createElement('span');
    const nowPlayingText = this.localize('Now Playing');

    nowPlayingEl.className = 'vjs-playlist-now-playing-text';
    nowPlayingEl.appendChild(document.createTextNode(nowPlayingText));
    nowPlayingEl.setAttribute('title', nowPlayingText);
    this.thumbnail.appendChild(nowPlayingEl);

    // Title container contains title and "up next"
    const titleContainerEl = document.createElement('div');
    titleContainerEl.className = 'vjs-playlist-title-container';
    this.thumbnail.appendChild(titleContainerEl);


    // Up next
    const upNextEl = document.createElement('span');
    const upNextText = this.localize('Up Next');
    upNextEl.className = 'vjs-up-next-text';
    upNextEl.appendChild(document.createTextNode(upNextText));
    upNextEl.setAttribute('title', upNextText);
    this.thumbnail.appendChild(upNextEl);

    // Title and description
    const title = this.options_.item.info?.title || this.localize('Untitled Video');
    const titleEl = document.createElement('cite');
    titleEl.className = 'vjs-playlist-name';
    titleEl.textContent = title;
    titleEl.title = title;
    titleContainerEl.appendChild(titleEl); 



    if (this.options_.showDescription && this.options_.item.info?.description) {
      const descEl = document.createElement('div');
      descEl.className = 'vjs-playlist-description';
      descEl.textContent = this.options_.item.info.description;
      descEl.title = this.options_.item.info.description;
      titleContainerEl.appendChild(descEl);
    }

    return li;
  }
}

// @ts-ignore
videojs.registerComponent('PlaylistMenuItem', PlaylistMenuItem);