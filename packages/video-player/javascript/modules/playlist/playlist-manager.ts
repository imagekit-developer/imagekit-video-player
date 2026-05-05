import videojs from 'video.js';
import type Player from 'video.js/dist/types/player';
import type ComponentType from 'video.js/dist/types/component';
import { isEqual, pick } from 'lodash'

import { Playlist } from './playlist';
import { AutoAdvance } from './auto-advance';
import { PlaylistMenu } from './playlist-menu';
import type { SourceOptions, PlaylistOptions, IKPlayerOptions } from '../../interfaces';
import type { Player as ImageKitPlayer } from '../../interfaces/Player';
import { isIndexInBounds, SOURCE_OPTION_KEYS } from './utils';
import './present-upcoming';
import { PresentUpcoming } from './present-upcoming';
import './components/playlist-next-button';
import './components/playlist-previous-button';

// Exported for testing purposes
export const log = videojs.log.createLogger('videojs-playlist');

export class PlaylistManager {
  private player_: Player;
  private playlist_: Playlist;
  private autoAdvance_: AutoAdvance;
  private playlistMenu?: PlaylistMenu;
  private playerOptions_: IKPlayerOptions;
  private playerContainer_?: HTMLElement;
  private playlistOptions_: PlaylistOptions;
  private presentUpcomingComponent_?: PresentUpcoming;
  private presentUpcomingThreshold_: number | null = null;
  private isUpcomingDismissed_ = false;


  constructor(player: Player, playerOptions: IKPlayerOptions) {
    this.player_ = player;
    this.playerOptions_ = playerOptions;
    this.playlistOptions_ = {};
    this.playlist_ = new Playlist({
      onError: msg => player.error(msg),
      onWarn: msg => player.log.warn(msg)
    });
    this.autoAdvance_ = new AutoAdvance(this.player_, this.playNext_);


    /**
     * Loads a playlist and sets up related functionality.
     * @param sources - Array of sources to load
     * @param opts - Options for the playlist
     * @returns The playlist manager instance
     */
    (player as any).playlist = ({
      sources,
      options: opts
    }: {
      sources?: SourceOptions[],
      options?: PlaylistOptions
    }): PlaylistManager => {
      const playerEl = this.player_.el();

      let wrapper = playerEl.parentElement;
      if (!wrapper || !wrapper.classList.contains('ik-player-container')) {
        wrapper = document.createElement('div');
        wrapper.className = 'ik-player-container';
        playerEl.parentNode?.insertBefore(wrapper, playerEl);
        wrapper.appendChild(playerEl);
      }

      this.playerContainer_ = wrapper as HTMLElement;

      if (sources && Array.isArray(sources)) {
        this.loadPlaylist(Playlist.from(sources, {
          onError: msg => player.error(msg),
          onWarn: msg => player.log.warn(msg)
        }));
      }

      this.playlistOptions_ = opts || {};
      this.configure(opts || {});
      this.initMenu_(opts || {});
      this.addUiComponents();

      this.player_.one('loadedmetadata', () => this.updateLayout_());

      return this;
    };

    this.player_.on('playerresize', () => this.updateLayout_());

  }

  /**
   * Applies dynamic styles to the player and playlist container.
   * @private
   */
  private updateLayout_() {
    if (!this.playerContainer_) {
      return;
    }

    const playerWithOptions = this.player_ as unknown as {
      options_: {
        fluid?: boolean;
      };
    };
    const isFluid = playerWithOptions.options_.fluid;

    if (isFluid) {
      this.playerContainer_.style.width = '';
      this.playerContainer_.style.height = '';
      if (this.playlistMenu) {
        (this.playlistMenu.el() as HTMLElement).style.width = '';
        (this.playlistMenu.el() as HTMLElement).style.height = '';
      }
      return;
    }

    const playerWidth = this.player_.width();
    const playerHeight = this.player_.height();

    if (!playerWidth || !playerHeight) {
      return;
    }

    const opts = this.playlistOptions_ || {};
    const isHorizontal = opts.widgetProps?.direction === 'horizontal';

    if (isHorizontal) {
      const playlistHeight = Math.min(playerHeight * 0.45, 200);
      this.playerContainer_.style.width = `${playerWidth}px`;
      this.playerContainer_.style.height = `${playerHeight + playlistHeight}px`;
      if (this.playlistMenu) {
        (this.playlistMenu.el() as HTMLElement).style.height = `${playlistHeight}px`;
      }
    } else {
      const playlistWidth = playerWidth * 0.45;
      this.playerContainer_.style.width = `${playerWidth + playlistWidth}px`;
      this.playerContainer_.style.height = `${playerHeight}px`;
      if (this.playlistMenu) {
        (this.playlistMenu.el() as HTMLElement).style.width = `${playlistWidth}px`;
      }
    }
  }

  private initMenu_(opts: PlaylistOptions) {
    this.playlistMenu?.dispose();

    const defaults = {
      className: 'vjs-playlist',
      playOnSelect: true
    };

    const uiOpts = videojs.mergeOptions(defaults, opts.widgetProps || {});

    const menuOptions = {
      className: uiOpts.className,
      horizontal: uiOpts.direction === 'horizontal',
      showDescription: uiOpts.showDescription
    };

    const menu = new PlaylistMenu(this.player_, this.playlist_, menuOptions, this.playerOptions_);

    if (this.playerContainer_) {
      this.playerContainer_.appendChild(menu.el());
      this.playerContainer_.classList.toggle('vjs-playlist-horizontal-container', menuOptions.horizontal);
    }

    this.playlistMenu = menu;
    (this.player_ as any).playlistMenu = menu;
  }

  /**
   * Configures looping, auto-advance, and present upcoming settings.
   */
  public configure(opts: PlaylistOptions = {}) {
    if (opts.repeat) {
      this.playlist_.enableRepeat();
    } else {
      this.playlist_.disableRepeat();
    }

    if (opts.autoAdvance === false) {
      this.autoAdvance_.setDelay(false);
    } else if (typeof opts.autoAdvance === 'number') {
      this.autoAdvance_.setDelay(opts.autoAdvance);
    }

    if (opts.presentUpcoming === false) {
      this.presentUpcomingThreshold_ = null;
    } else if (typeof opts.presentUpcoming === 'number' && opts.presentUpcoming > 0) {
      this.presentUpcomingThreshold_ = opts.presentUpcoming;
    } else if (opts.presentUpcoming === true) {
      this.presentUpcomingThreshold_ = 10;
    } else {
      this.presentUpcomingThreshold_ = null;
    }
    this.setupPresentUpcoming_();
  }

  private addUiComponents() {
    const controlBar = this.player_.getChild('ControlBar') as ComponentType | null;
    if (!controlBar) return;
    
    const controlBarWithMethods = controlBar as unknown as {
      children(): Array<{ name_?: string }>;
      addChild(name: string, options?: any, index?: number): ComponentType;
    };
    const children = controlBarWithMethods.children();
    const playToggleIndex = children.findIndex(c => c.name_ === 'PlayToggle');
    
    controlBarWithMethods.addChild('PlaylistPreviousButton', {}, playToggleIndex);
    controlBarWithMethods.addChild('PlaylistNextButton', {}, playToggleIndex + 1);
  }

  /**
   * Loads a new playlist array.
   * @param sources - Array of sources to load
   */
  public setPlaylistItems(sources: SourceOptions[]) {
    this.playlist_.setItems(sources);
    this.loadFirstItem();
  }

  /**
   * Gets the current playlist array.
   * @returns Array of playlist items
   */
  public getItems(): SourceOptions[] {
    return this.playlist_.getItems();
  }

  /**
   * Advances to the next item in the playlist.
   */
  public playNext(): void {
    const next = this.playlist_.getNextIndex();
    if (next < 0) { return; }
    this.playAtIndex(next);
  }

  /**
   * Advances to the previous item in the playlist.
   */
  public playPrevious(): void {
    const previous = this.playlist_.getPreviousIndex();
    if (previous < 0) { return; }
    this.playAtIndex(previous);
  }

  /**
   * Plays a specific item in the playlist by index.
   * @param index - The index of the item to play
   */
  public playAtIndex(index: number): void {
    this.playlist_.setCurrentIndex(index);
    this.player_.src(this.playlist_.getCurrentItem());

    this.player_.one('loadedmetadata', () => {
      this.player_.play();
    });
  }

  /**
   * Loads a playlist and sets up related functionality.
   * @param playlist - The playlist to load
   */
  public loadPlaylist(playlist: Playlist) {
    this.unloadPlaylist();

    this.playlist_ = playlist;
    this.autoAdvance_ = new AutoAdvance(this.player_, this.playNext_);

    this.setupEventForwarding_();
    this.player_.on('loadstart', this.handleSourceChange_);
  }

  /**
   * Unloads the current playlist and associated functionality.
   */
  public unloadPlaylist() {
    if (this.playlist_) {
      this.playlist_.reset();
      this.cleanupEventForwarding_();
    }

    if (this.autoAdvance_) {
      this.autoAdvance_.fullReset();
    }

    this.presentUpcomingComponent_?.dispose();
    this.player_.off('timeupdate', this.handleTimeUpdateForUpcoming_);
    this.player_.off('loadstart', this.handleSourceChange_);
  }

  /**
   * Retrieves the currently loaded playlist object.
   * @returns The current Playlist instance, or null if one is not loaded
   */
  public getPlaylist(): Playlist | null {
    return this.playlist_;
  }

  /**
   * Gets or sets the auto-advance configuration for the playlist.
   * A positive integer sets the delay in seconds before playing the next video.
   * A value of false cancels auto-advance.
   * A value of 0 causes the next video to play immediately after the previous one finishes.
   * @param delayInSeconds - The delay in seconds, false to disable, or undefined to get current value
   * @returns The current delay value when getting, or void when setting
   */
  autoAdvanceDelay(delayInSeconds?: number | false): number | null | void {
    if (delayInSeconds === undefined) {
      return this.autoAdvance_.getDelay();
    }

    this.autoAdvance_.setDelay(delayInSeconds);
    return;
  }

  /**
   * Loads a specific playlist item by index.
   * @param index - The index of the item to load
   * @returns True if the item was loaded successfully, false otherwise
   */
  loadPlaylistItem(index: number): boolean {
    const items = this.playlist_.getItems();

    if (!isIndexInBounds(items, index)) {
      log.error('Index is out of bounds.');
      return false;
    }

    this.loadItem_(items[index]);
    this.playlist_.setCurrentIndex(index);

    return true;
  }

  /**
   * Loads the first item in the playlist.
   * @returns True if the first item was loaded successfully, false otherwise
   */
  loadFirstItem(): boolean {
    return this.loadPlaylistItem(0);
  }

  /**
   * Loads the last item in the playlist.
   * @returns True if the last item was loaded successfully, false otherwise
   */
  loadLastItem(): boolean {
    const lastIndex = this.playlist_.getLastIndex();

    return this.loadPlaylistItem(lastIndex);
  }

  /**
   * Loads the next item in the playlist.
   * @returns True if the next item was loaded successfully, false otherwise
   */
  loadNextItem(): boolean {
    const nextIndex = this.playlist_.getNextIndex();

    if (nextIndex === -1) {
      return false;
    }

    return this.loadPlaylistItem(nextIndex);
  }

  /**
   * Loads the previous item in the playlist.
   * @returns True if the previous item was loaded successfully, false otherwise
   */
  loadPreviousItem() {
    const previousIndex = this.playlist_.getPreviousIndex();

    if (previousIndex === -1) {
      return false;
    }

    return this.loadPlaylistItem(previousIndex);
  }

  /**
   * Loads a specific playlist item.
   * @param item - The playlist item to load
   * @private
   */
  private loadItem_(item: SourceOptions) {
    this.player_.trigger('beforeplaylistitem', item);
    this.clearExistingItemTextTracks_();
    this.player_.src(item);

    this.player_.ready(() => {
      this.player_.trigger('playlistitem', item);
    });
  }

  /**
   * Sets up event forwarding from the playlist to the player.
   * @private
   */
  private setupEventForwarding_() {
    const playlistEvents = ['playlistchange', 'playlistadd', 'playlistremove', 'playlistsorted'];

    playlistEvents.forEach((eventType) => this.playlist_.on(eventType, this.handlePlaylistEvent_));
  }

  /**
   * Cleans up event forwarding from the playlist to the player.
   * @private
   */
  private cleanupEventForwarding_() {
    const playlistEvents = ['playlistchange', 'playlistadd', 'playlistremove', 'playlistsorted'];

    playlistEvents.forEach((eventType) => this.playlist_.off(eventType, this.handlePlaylistEvent_));
  }

  /**
   * Handles playlist events and forwards them to the player.
   * @param event - The playlist event to handle
   * @private
   */
  private handlePlaylistEvent_ = (event: Event) => {
    this.player_.trigger(event);
  };

  /**
   * Plays the next item in the playlist.
   * @private
   */
  playNext_ = () => {
    const loadedNext = this.loadNextItem();

    if (loadedNext) {
      this.player_.one('loadstart', () => {
        this.player_.play();
      });
    }
  };

  /**
   * Clears text tracks of the currently loaded item.
   * @private
   */
  private clearExistingItemTextTracks_() {
    const playerWithTextTracks = this.player_ as unknown as {
      remoteTextTracks(): TextTrackList;
      removeRemoteTextTrack(track: TextTrack): void;
    };
    const textTracks = playerWithTextTracks.remoteTextTracks();
    let i = textTracks && textTracks.length || 0;

    while (i--) {
      playerWithTextTracks.removeRemoteTextTrack(textTracks[i]);
    }
  }

  /**
   * Adds text tracks for a playlist item.
   * @param item - The playlist item
   * @private
   */
  private addItemTextTracks_(item: SourceOptions) {
    if (item.textTracks) {
      item.textTracks.forEach((track) => this.player_.addRemoteTextTrack(track));
    }
  }

  /**
   * Handles changes to the player's source.
   * @private
   */
  private handleSourceChange_ = () => {
    const player = this.player_ as unknown as ImageKitPlayer;
    const pluginInstance = player.imagekitVideoPlayer();
    const currentSrc = pluginInstance.getOriginalCurrentSource();

    if (!currentSrc || !this.isSourceInPlaylist_(currentSrc)) {
      this.handleNonPlaylistSource_();
    }
  };

  /**
   * Checks if the current source is in the playlist.
   * @param src - The source to check
   * @returns True if the source is in the playlist, false otherwise
   * @private
   */
  private isSourceInPlaylist_(src: SourceOptions): boolean {
    const itemList = this.playlist_.getItems();
    return itemList.some((item) => {
      return isEqual(pick(item, SOURCE_OPTION_KEYS), pick(src, SOURCE_OPTION_KEYS))}
    );
  }

  /**
   * Handles playback when the current source is not in the playlist.
   * @private
   */
  private handleNonPlaylistSource_() {
    this.autoAdvance_.fullReset();
    this.playlist_.setCurrentIndex(null);
  }

  private handleUpcomingDismiss_ = () => {
    this.isUpcomingDismissed_ = true;
    this.presentUpcomingComponent_?.hide();
  };

  private setupPresentUpcoming_() {
    this.presentUpcomingComponent_?.dispose();
    this.player_.off('timeupdate', this.handleTimeUpdateForUpcoming_);
  
    if (this.presentUpcomingThreshold_ === null) {
      return;
    }
  
    this.presentUpcomingComponent_ = this.player_.addChild('PresentUpcoming', this.playerOptions_) as PresentUpcoming;
    this.presentUpcomingComponent_.on('dismiss', this.handleUpcomingDismiss_);
    this.player_.on('timeupdate', this.handleTimeUpdateForUpcoming_);
  
    this.player_.on('loadstart', () => {
      this.presentUpcomingComponent_?.hide();
      this.isUpcomingDismissed_ = false;
    });
  }


  private handleTimeUpdateForUpcoming_ = () => {
    if (!this.presentUpcomingComponent_ || this.presentUpcomingThreshold_ === null) {
      return;
    }
  
    const currentTime = this.player_.currentTime();
    const duration = this.player_.duration();
  
    if (!currentTime || !duration || !isFinite(duration) || !isFinite(currentTime)) {
      return;
    }
  
    const remainingTime = duration - currentTime;
    const isTimeToShow = remainingTime <= this.presentUpcomingThreshold_ && remainingTime > 0 && !this.isUpcomingDismissed_;
  
    if (isTimeToShow) {
      if (this.presentUpcomingComponent_.hasClass('vjs-hidden')) {
        const nextIndex = this.playlist_.getNextIndex();
  
        if (nextIndex !== -1) {
          const nextItem = this.playlist_.getItems()[nextIndex];
          this.presentUpcomingComponent_.update(nextItem);
          this.presentUpcomingComponent_.show();
        }
      }
    } else {
      if (!this.presentUpcomingComponent_.hasClass('vjs-hidden')) {
        this.presentUpcomingComponent_.hide();
      }
    }
  };
}