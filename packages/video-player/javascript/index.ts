import videojs, { type Player as VideoJsPlayer } from 'video.js';
import PluginType from 'video.js/dist/types/plugin';
import './modules/http-source-selector/plugin';
import './modules/context-menu/plugin';
import type { IKPlayerOptions, Player } from './interfaces';
import type { SourceOptions } from './interfaces';
import type { AugmentedSourceOptions } from './interfaces/AugementedSourceOptions';

import { PlaylistManager } from './modules/playlist/playlist-manager';
import { SeekThumbnailsManager } from './modules/seek-thumbnails/seek-thumbnails-manager';
import { initChapterMarkers } from './modules/chapters/chapters';
import './modules/recommendations-overlay/recommendations-overlay';
import { ShoppableManager } from './modules/shoppable/shoppable-manager';
import { validateIKPlayerOptions, CleanupRegistry } from './utils';
import { enableFloatingPlayer } from './modules/floating-player';
import './modules/logo-button';
import { initializeLogoButton } from './modules/logo-button/init';
import { setupKeyboardShortcuts } from './modules/keyboard-shortcuts';
import { setupContextMenu } from './modules/context-menu/setup';
import { createSourceOverride } from './modules/source-handler';
import { extendTrackSettings } from './modules/subtitles/track-settings-extension';

const defaults: IKPlayerOptions = {
  imagekitId: '',
  floatingWhenNotVisible: null,
  hideContextMenu: false,
  logo: { showLogo: false, logoImageUrl: '', logoOnclickUrl: '' },
  seekThumbnails: true,
  maxTries: 3,
  videoTimeoutInMS: 55000,
};

const Plugin = videojs.getPlugin('plugin') as typeof PluginType;
/**
 * ImageKit Video Player plugin for Video.js
 * Extends Video.js with ImageKit-specific features like seek thumbnails, chapters, recommendations, and shoppable videos.
 */
class ImageKitVideoPlayerPlugin extends Plugin {
  private ikGlobalSettings_: IKPlayerOptions;
  private currentSource_: SourceOptions | null = null;
  private originalCurrentSource_: SourceOptions | null = null;
  private playlistManager_?: PlaylistManager;
  private seekThumbnailsManager_?: SeekThumbnailsManager;
  private shoppableManager_?: ShoppableManager;
  private cleanup_ = new CleanupRegistry();


  constructor(player: Player, options: IKPlayerOptions) {
    super(player);

    this.ikGlobalSettings_ = videojs.mergeOptions(defaults, options);
    try {
      validateIKPlayerOptions(this.ikGlobalSettings_);

      this.overrideSrc();

      this.playlistManager_ = new PlaylistManager(this.player, this.ikGlobalSettings_);

      if (this.ikGlobalSettings_.floatingWhenNotVisible) {
        const floatingCleanup = enableFloatingPlayer(this.player, this.ikGlobalSettings_.floatingWhenNotVisible);
        if (floatingCleanup) {
          this.cleanup_.register(floatingCleanup);
        }
      }

      this.player.on('loadstart', async () => {
        if (this.seekThumbnailsManager_) {
          this.seekThumbnailsManager_.destroy(this.player);
          this.seekThumbnailsManager_ = undefined;
        }

        if (this.shoppableManager_) {
          this.shoppableManager_.destroy();
          this.shoppableManager_ = undefined;
        }

        const initPromises: Promise<void>[] = [];

        if (this.ikGlobalSettings_.seekThumbnails && this.currentSource_) {
          initPromises.push(
            SeekThumbnailsManager.initSeekThumbnails(
              this.player,
              this.currentSource_,
              this.ikGlobalSettings_
            ).then(mgr => {
              if (mgr) {
                this.seekThumbnailsManager_ = mgr;
              }
            })
          );
        }

        initPromises.push(
          initChapterMarkers(this.player, this.currentSource_, this.ikGlobalSettings_)
        );

        initPromises.push(this.initRecommendationsOverlay());

        if (this.currentSource_?.shoppable) {
          this.shoppableManager_ = new ShoppableManager(this.player, this.currentSource_);
        }

        await Promise.all(initPromises);
      });

      this.player.ready(() => {
        const playerEl = this.player.el();

        this.cleanup_.registerEventListener(
          playerEl,
          'mouseleave',
          () => {
            if (!this.player.paused()) {
              this.player.addClass('vjs-user-inactive');
            }
          }
        );

        this.cleanup_.registerEventListener(
          playerEl,
          'mouseenter',
          () => {
            this.player.removeClass('vjs-user-inactive');
          }
        );

        initializeLogoButton(this.player, this.ikGlobalSettings_);
        extendTrackSettings(this.player);
      });

      this.player.ready(() => {
        setupKeyboardShortcuts(this.player, this.cleanup_);
      });
    }
    catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      player.error(`ImageKitVideoPlayerPlugin: ${errorMessage}`);
    }
  }
  /**
   * Overrides the Video.js src method to handle ImageKit source preparation,
   * including URL signing, transformations, and ABS (HLS/DASH) support.
   */
  private overrideSrc() {
    this.player.src = createSourceOverride(this.player, {
      options: this.ikGlobalSettings_,
      getCurrentSource: () => {
        return this.currentSource_;
      },
      onSourceUpdate: (source: SourceOptions) => {
        this.currentSource_ = source;
      },
      onOriginalSourceUpdate: (source: SourceOptions) => {
        this.originalCurrentSource_ = source;
      },
      hasPreparedSrc: (opts: SourceOptions): opts is AugmentedSourceOptions => {
        return (opts as any).prepared && typeof (opts as any).prepared.src === 'string';
      },
    }) as any;
  }


  /**
   * Initializes the recommendations overlay if recommendations are provided in the source.
   */
  private async initRecommendationsOverlay() {
    if (!this.currentSource_ || !this.currentSource_.recommendations) return;

    const overlay = this.player.getChild('RecommendationsOverlay');
    if (overlay) overlay.dispose();
    this.player.addChild('RecommendationsOverlay', { recommendations: this.currentSource_.recommendations, playerOptions: this.ikGlobalSettings_ });
  }

  /**
   * Gets the current source being played, after ImageKit processing.
   * @returns The current source or null if none is set
   */
  public getCurrentSource() {
    return this.currentSource_;
  }

  /**
   * Gets the original source as provided by the user, before ImageKit processing.
   * @returns The original source or null if none is set
   */
  public getOriginalCurrentSource() {
    return this.originalCurrentSource_;
  }

  /**
   * Gets the playlist manager instance if a playlist is active.
   * @returns The playlist manager instance or undefined
   */
  public getPlaylistManager() {
    return this.playlistManager_;
  }

  /**
   * Gets the ImageKit player options that were used to initialize the plugin.
   * @returns The ImageKit player options
   */
  public getPlayerOptions = (): IKPlayerOptions => {
    return this.ikGlobalSettings_;
  }

  /**
   * Clean up all event listeners and resources when the plugin is disposed.
   */
  dispose(): void {
    this.cleanup_.dispose();
    super.dispose();
  }
}

videojs.registerPlugin('imagekitVideoPlayer', ImageKitVideoPlayerPlugin);

/**
 * Creates and initializes an ImageKit Video Player instance.
 * @param element - The video element ID or HTMLElement
 * @param options - ImageKit player configuration options
 * @param videoJsOptions - Optional Video.js player options
 * @returns The initialized Video.js player instance with ImageKit extensions
 */
export function videoPlayer(
  element: string | HTMLElement,
  options: IKPlayerOptions,
  videoJsOptions: any = {}
): Player {

  const player: VideoJsPlayer = videojs(element, {
    ...videoJsOptions,
    html5: { nativeTextTracks: false },
    plugins: {
      ...(videoJsOptions.plugins ?? {}),
      httpSourceSelector: { default: 'auto' },
      imagekitVideoPlayer: options,
    },
  });

  setupContextMenu(player, options);

  if (!('playlist' in player) || typeof (player as any).playlist !== 'function') {
    throw new Error('ImageKit video player plugin failed to initialize: playlist method not found');
  }

  return player as unknown as Player;
}

export * from './interfaces';