import videojs from 'video.js';
import type Player from 'video.js/dist/types/player';

import { Playlist } from './playlist';
import { AutoAdvance } from './auto-advance';
import { PlaylistMenu } from './playlist-menu';
import type { SourceOptions, PlaylistOptions, PlayerOptions } from '../../interfaces';
import { isIndexInBounds } from './utils';

// detect pointer-events support
const supportsCssPointerEvents = (() => {
  const el = document.createElement('x');
  el.style.cssText = 'pointer-events:auto';
  return el.style.pointerEvents === 'auto';
})();

// Exported for testing purposes
export const log = videojs.log.createLogger('videojs-playlist');

export class PlaylistManager {
  private player_: Player;
  private playlist_: Playlist;
  private autoAdvance_: AutoAdvance;
  private playlistMenu?: PlaylistMenu;
  private playerOptions_: PlayerOptions;

  constructor(player: Player, playerOptions: PlayerOptions) {
    this.player_ = player;
    this.playerOptions_ = playerOptions;
    this.playlist_ = new Playlist({
      onError: msg => player.error(msg),
      onWarn: msg => player.log.warn(msg)
    });
    this.autoAdvance_ = new AutoAdvance(this.player_, this.playNext_);


    /**
     * @method playlist
     * @param {Array} sources - Array of sources to load
     * @param {Object} opts - Options for the playlist
     * @returns {PlaylistManager} - The playlist manager instance
     * @description Loads a playlist and sets up related functionality.
     */
    // Add playlist method to player
    (player as any).playlist = ({
      sources,
      options: opts
    }: {
      sources?: SourceOptions[],
      options?: PlaylistOptions
    }): PlaylistManager => {

      // Wrap the player's outer element in a container
      const playerEl = this.player_.el();
      const wrapper = document.createElement('div');
      wrapper.className = 'player-container';
      playerEl.parentNode?.insertBefore(wrapper, playerEl);
      wrapper.appendChild(playerEl);

      // Load the playlist if provided
      if (sources && Array.isArray(sources)) {
        this.loadPlaylist(Playlist.from(sources, {
          onError: msg => player.error(msg),
          onWarn: msg => player.log.warn(msg)
        }));
      }
      this.configure(opts || {});
      this.initMenu_(opts || {});
      return this;
    };

    // 2) Create the (empty) menu on startup
    // this.initMenu_({});
  }

  /** @private Initialize or re-initialize the UI component */
  private initMenu_(opts: PlaylistOptions) {
    // tear down old
    this.playlistMenu?.dispose();

    // UI defaults
    const defaults = {
      className: 'vjs-playlist',
      playOnSelect: true,
      supportsCssPointerEvents
    };

    // merge in widgetProps
    const uiOpts = videojs.mergeOptions(defaults, opts.widgetProps || {}) as any;

    // determine container:
    // 1) user-provided el, if valid
    // 2) first empty .className in DOM
    // 3) fallback to player.el()
    let container: HTMLElement;
    if (uiOpts.el && videojs.dom.isEl(uiOpts.el)) {
      container = uiOpts.el;
    } else {
      const found = document.querySelector(`.${uiOpts.className}`) as HTMLElement;
      if (found && found.childElementCount === 0) {
        container = found;
      } else {
        // container = this.player_.el();
        // Fallback: create a new div next to the player
        const wrapper = this.player_.el().parentElement!;
        container = document.createElement('div');
        container.className = uiOpts.className;
        wrapper.appendChild(container);
      }
    }
    uiOpts.el = container;

    // instantiate & expose
    const menu = new PlaylistMenu(this.player_, this.playlist_, {}, this.playerOptions_);

    // **NEW**: actually attach it
    //   .el() is the Component API for "get my root element"
    container.appendChild(menu.el());

    this.playlistMenu = menu;
    (this.player_ as any).playlistMenu = menu;
  }

  /** Configure looping & auto-advance */
  public configure(opts: PlaylistOptions = {}) {
    // repeat
    if (opts.repeat) {
      this.playlist_.enableRepeat();
    } else {
      this.playlist_.disableRepeat();
    }
    // autoAdvance
    if (opts.autoAdvance === false) {
      this.autoAdvance_.setDelay(false);
    } else if (typeof opts.autoAdvance === 'number') {
      this.autoAdvance_.setDelay(opts.autoAdvance);
    }
  }

  /** Load a new playlist array */
  public setPlaylistItems(sources: SourceOptions[]) {
    this.playlist_.setItems(sources);
    this.loadFirstItem();
  }

  /** Get the current playlist array */
  public getItems(): SourceOptions[] {
    return this.playlist_.getItems();
  }

  /** Advance to next item */
  public playNext(): void {
    const next = this.playlist_.getNextIndex();
    if (next < 0) { return; }
    this.playAtIndex(next);
  }

  /** Play a specific index */
  public playAtIndex(index: number): void {
    this.playlist_.setCurrentIndex(index);

    // 1) Kick off your async overrideSrc(...) logic:
    this.player_.src(this.playlist_.getCurrentItem());

    // 2) Wait for Video.js to actually begin loading that new source:
    this.player_.one('loadedmetadata', () => {
      this.player_.play();
    });
  }

  /**
 * Loads a playlist and sets up related functionality.
 *
 * @param {Playlist} playlist - The playlist to load.
 */
  public loadPlaylist(playlist: Playlist) {
    // Clean up any existing playlist
    this.unloadPlaylist();

    this.playlist_ = playlist;
    this.autoAdvance_ = new AutoAdvance(this.player_, this.playNext_);

    this.setupEventForwarding_();

    // Begin handling non-playlist source changes.
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

    // Stop handling non-playlist source changes
    this.player_.off('loadstart', this.handleSourceChange_);
  }

  /**
* Retrieves the currently loaded playlist object
*
* @return {Playlist|null} The current Playlist instance, or null if one is not loaded.
*/
  public getPlaylist(): Playlist | null {
    return this.playlist_;
  }

  /*
  * Gets or sets the autoAdvance configuration for the playlist
  Gets or sets the autoAdvance configuration for the playlist.

A positive integer delay value sets the delay in seconds that the player will wait before playing the next video.

A value of false cancels auto advance. (To move to the next video use playNext).

A value of 0 causes the next video to play immediately after the previous one finishes.
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
  *
  * @param {number} index - The index of the item to load.
  * @return {boolean} True if the item was loaded successfully, false otherwise.
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
   *
   * @return {boolean} True if the first item was loaded successfully, false otherwise.
   */
  loadFirstItem(): boolean {
    return this.loadPlaylistItem(0);
  }

  /**
   * Loads the last item in the playlist.
   *
   * @return {boolean} True if the last item was loaded successfully, false otherwise.
   */
  loadLastItem(): boolean {
    const lastIndex = this.playlist_.getLastIndex();

    return this.loadPlaylistItem(lastIndex);
  }

  /**
   * Loads the next item in the playlist.
   * @return {boolean} True if the next item was loaded successfully, false otherwise.
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
   *
   * @return {boolean} True if the previous item was loaded successfully, false otherwise.
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
   * @param {SourceOptions} item - The playlist item to load.
   * @private
   */
  private loadItem_(item: SourceOptions) {
    this.player_.trigger('beforeplaylistitem', item);

    // Remove any textTracks from a previous item
    this.clearExistingItemTextTracks_();

    // Set the source for the player
    this.player_.src(item);

    this.player_.ready(() => {
      this.addItemTextTracks_(item);
      this.player_.trigger('playlistitem', item);
    });
  }

  /**
   * Sets up event forwarding from the playlist to the player.
   *
   * @private
   */
  private setupEventForwarding_() {
    const playlistEvents = ['playlistchange', 'playlistadd', 'playlistremove', 'playlistsorted'];

    playlistEvents.forEach((eventType) => this.playlist_.on(eventType, this.handlePlaylistEvent_));
  }

  /**
   * Cleans up event forwarding from the playlist to the player.
   *
   * @private
   */
  private cleanupEventForwarding_() {
    const playlistEvents = ['playlistchange', 'playlistadd', 'playlistremove', 'playlistsorted'];

    playlistEvents.forEach((eventType) => this.playlist_.off(eventType, this.handlePlaylistEvent_));
  }

  /**
   * Handles playlist events and forwards them to the player.
   *
   * @param {Event} event - The playlist event to handle.
   * @private
   */
  private handlePlaylistEvent_ = (event: Event) => {
    this.player_.trigger(event);
  };

  /**
   * Plays the next item in the playlist
   *
   * @private
   */
  playNext_ = () => {
    const loadedNext = this.loadNextItem();

    if (loadedNext) {
      // 2) Wait for loadstart or loadedmetadata, then play:
      this.player_.one('loadstart', () => {
        this.player_.play();
      });

    }
  };

  /**
   * Clears text tracks of the currently loaded item.
   *
   * @private
   */
  private clearExistingItemTextTracks_() {
    // @todo: this should be available in videojs
    // @ts-ignore
    const textTracks = this.player_.remoteTextTracks();
    // @ts-ignore
    let i = textTracks && textTracks.length || 0;

    // This uses a `while` loop rather than `forEach` because the
    // `TextTrackList` object is a live DOM list (not an array).
    while (i--) {
      // @ts-ignore
      this.player_.removeRemoteTextTrack(textTracks[i]);
    }
  }

  /**
   * Adds text tracks for a playlist item.
   *
   * @param {Object} item - The playlist item.
   * @private
   */
  private addItemTextTracks_(item: SourceOptions) {
    if (item.textTracks) {
      item.textTracks.forEach((track) => this.player_.addRemoteTextTrack(track));
    }
  }

  /**
   * Handles changes to the player's source.
   *
   * @private
   */
  private handleSourceChange_ = () => {
    //@ts-ignore
    const currentSrc = this.player_.imagekitVideoPlayer().getOriginalCurrentSource();

    if (!this.isSourceInPlaylist_(currentSrc)) {
      this.handleNonPlaylistSource_();
    }
  };

  /**
   * Checks if the current source is in the playlist.
   *
   * @param {SourceOptions} src - The source URL to check.
   * @return {boolean} True if the source is in the playlist, false otherwise.
   * @private
   */
  private isSourceInPlaylist_(src: SourceOptions): boolean {
    const itemList = this.playlist_.getItems();
    return itemList.some((item) => {
      // do a deep comparison of the source object
      return JSON.stringify(item) === JSON.stringify(src);
    }
    );
  }

  /**
   * Handles playback when the current source is not in the playlist.
   *
   * @private
   */
  private handleNonPlaylistSource_() {
    this.autoAdvance_.fullReset();
    this.playlist_.setCurrentIndex(null);
  }
}