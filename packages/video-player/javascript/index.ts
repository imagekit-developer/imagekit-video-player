import { initVttRedirect } from './modules/seek-thumbnails/mockSeekThumbnailsVTT';
import { initSubtitlesRedirect, defaultSubtitlesMap } from './modules/subtitles/mockSubtitlesUrlFetch';

// ————————————————
// MOCK SETUP (for local/dev/demo only)
// ————————————————
initVttRedirect("https://ik.imagekit.io/zuqlyov9d/default.vtt?updatedAt=1747359261941&ik-s=92c20a03ddc26ab8efa179fc0ffa11dc132590e6");

// Initialize subtitles redirect with default mapping
initSubtitlesRedirect(defaultSubtitlesMap);

import videojs from 'video.js';
import PluginType from 'video.js/dist/types/plugin';
import './modules/http-source-selector/plugin';
import './modules/context-menu/plugin';
import type { PlayerOptions, RemoteTextTrackOptions } from './interfaces';
import type Player from 'video.js/dist/types/player';
import type { SourceOptions } from './interfaces';

import { PlaylistManager } from './modules/playlist/playlist-manager';
import { SeekThumbnailsManager } from './modules/seek-thumbnails/seek-thumbnails-manager';
import { ChapterMarker, parseChaptersFromVTT } from './modules/chapters/chapterMarkerProgressBar';
import './modules/recommendations-overlay/recommendations-overlay';
import { overrideAddRemoteTextTrack } from './modules/subtitles/subtitles';
import { ShoppableManager } from './modules/shoppable/shoppable-manager';
import { prepareSource, normalizeInput, waitForVideoReady, preparePosterSrc, validateIKPlayerOptions, prepareChaptersVttSrc } from './utils';
import { enableFloatingPlayer } from './modules/floating-player';

const defaults: PlayerOptions = {
  imagekitId: 'random_id',
  floatingWhenNotVisible: null,
  hideContextMenu: false,
  logo: { showLogo: false, logoImageUrl: '', logoOnclickUrl: '' },
  seekThumbnails: true,
  maxTries: 3,
  videoTimeoutInMS: 55000,
  playedEventPercents: [25, 50, 75, 100],
};

const Plugin = videojs.getPlugin('plugin') as typeof PluginType;
class ImageKitVideoPlayerPlugin extends Plugin {
  private ikGlobalSettings_: PlayerOptions;
  private currentSource_: SourceOptions | SourceOptions[] | null = null;
  private originalCurrentSource_: SourceOptions | SourceOptions[] | null = null;
  private playlistManger_?: PlaylistManager;
  private seekThumbnailsManager_?: SeekThumbnailsManager;
  private shoppableManager_?: ShoppableManager;


  constructor(player: Player, options: PlayerOptions) {
    super(player);

    this.ikGlobalSettings_ = videojs.mergeOptions(defaults, options);
    try {
      validateIKPlayerOptions(this.ikGlobalSettings_);

      overrideAddRemoteTextTrack(this.player, this.getOriginalFirstSource,  this.ikGlobalSettings_.signerFn);
      this.overrideSrc();

      this.playlistManger_ = new PlaylistManager(this.player, this.ikGlobalSettings_);

      if (this.ikGlobalSettings_.floatingWhenNotVisible) {
        enableFloatingPlayer(this.player, this.ikGlobalSettings_.floatingWhenNotVisible);
      }

      this.player.on('loadstart', async () => {

        // INIT THUMBNAILS
        // 1) If a SeekThumbnailsManager already exists, tear it down:
        if (this.seekThumbnailsManager_) {
          this.seekThumbnailsManager_.destroy(this.player);
          this.seekThumbnailsManager_ = undefined;
        }

        // 1a) If a ShoppableManager already exists, tear it down:
        if (this.shoppableManager_) {
          this.shoppableManager_.destroy();
          this.shoppableManager_ = undefined;
        }

        const src = Array.isArray(this.currentSource_)
          ? this.currentSource_[0]
          : this.currentSource_;

        // 2) If seekThumbnails is enabled and currentSource_ is set, initialize a new mgr:
        if (this.ikGlobalSettings_.seekThumbnails && src) {

          const mgr = await SeekThumbnailsManager.initSeekThumbnails(
            this.player,
            src,
            this.ikGlobalSettings_
          );
          if (mgr) {
            this.seekThumbnailsManager_ = mgr;
          }
        }

        // CHAPTER MARKERS & RECOMMENDATIONS
        await this.initChapterMarkers();
        await this.initRecommendationsOverlay();

        if (src && src.shoppable) {
          this.shoppableManager_ = new ShoppableManager(this.player, src.shoppable);
        }
      });
    }
    catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      player.error(`ImageKitVideoPlayerPlugin: ${errorMessage}`);
    }
  }
  private srcCallVersion = 0;

  private overrideSrc() {
    const nativeSrc = this.player.src.bind(this.player);

    this.player.src = (raw: string | SourceOptions | Array<string | SourceOptions> | undefined) => {
      // increment the version on each call
      const myCallId = ++this.srcCallVersion;

      if (!raw) {
        return nativeSrc(raw as any);
      }

      // hide the big play button
      const bigPlay = this.player.getChild('BigPlayButton');
      bigPlay && bigPlay.hide();
      // show the spinner
      const spinner = this.player.getChild('LoadingSpinner');
      this.player.addClass('vjs-waiting');
      spinner?.el()?.setAttribute('aria-hidden', 'false');

      // normalize the input
      const inputs = normalizeInput(raw);

      // set originalCurrentSource_ for later use
      this.originalCurrentSource_ = typeof inputs[0] === 'string' ? { src: inputs[0] } : { ...inputs[0] };

      // prepare all of them in parallel
      Promise.all(inputs.map(i => prepareSource(i, this.ikGlobalSettings_)))
        .then(async (prepared: SourceOptions[]) => {
          // **only** apply if thisCall is still the last one they requested
          if (myCallId === this.srcCallVersion) {
            const { maxTries, videoTimeoutInMS, delayInMS } = this.ikGlobalSettings_;

            await waitForVideoReady(
              prepared[0].src,
              maxTries!,
              videoTimeoutInMS!,
              delayInMS
            );
            // store for later modules
            this.currentSource_ = prepared.length > 1 ? prepared : prepared[0];
            // Video.js expects either a single object or an array
            nativeSrc(prepared.length > 1 ? prepared as any : prepared[0] as any);
            // setup subtitles if any from the currentSource_
            const textTracks = Array.isArray(this.currentSource_)
              ? this.currentSource_[0].textTracks || []
              : this.currentSource_.textTracks || [];
            if (textTracks.length) {
              textTracks.forEach(track => this.player.addRemoteTextTrack(track as RemoteTextTrackOptions, false));
            }
            // setup poster
            const currentSource_ = Array.isArray(this.currentSource_)
              ? this.currentSource_[0]
              : this.currentSource_;
            preparePosterSrc(currentSource_, this.ikGlobalSettings_).then(
              poster => {
                if (poster) {
                  this.player.poster(poster);
                }
              }
            ).catch(err => {
              this.player.error(err.message);
            });

          }
        })
        .catch(err => {
          // signing/build error
          this.player.error(err.message);
        })
        .finally(() => {
          // hide the spinner and show the big play button
          bigPlay && bigPlay.show();
          this.player.removeClass('vjs-waiting');
          spinner?.el()?.setAttribute('aria-hidden', 'true');
        });
    };
  }

  private async initChapterMarkers() {
    if (!this.currentSource_) return;
    let src = Array.isArray(this.currentSource_) ? this.currentSource_[0] : this.currentSource_;
    if (!src.chapters) return;

    let chapterList: ChapterMarker[] = []
    if (typeof src.chapters === 'object' && 'url' in src.chapters) {
      try {
        const res = await fetch(src.chapters.url);
        if (!res.ok) {
          this.player.log.warn(`VTT fetch failed with status: (${res.status}); skipping chapters.`);
        }
        const data = await res.text();
        chapterList = parseChaptersFromVTT(data);
      } catch (e) {
        this.player.log.warn(`Failed to fetch chapters VTT: ${e}`);
        return;
      }
    } else if (typeof src.chapters === 'object') {
      // chapterList = Object.entries(src.chapters).map(([time, label]) => ({ time: Number(time), label }));
    } else if (src.chapters === true) {
      // if chapters is true, we assume it is a default vtt file
      try {
        const chaptersVttSrc = await prepareChaptersVttSrc(src, this.ikGlobalSettings_);
        // const res = await fetch(chaptersVttSrc);
        // mocking the fetch for now
        const res = await fetch('https://ik.imagekit.io/zuqlyov9d/chapters.vtt');
        if (!res.ok) {
          this.player.log.warn(`Default VTT fetch failed with status: (${res.status}); skipping chapters.`);
          return;
        }
        // add chapters track
        // @todo commented this. You are overriding remoteTextTrack. Verify the correctness of this.
        // const chaptersTrack = this.player.addRemoteTextTrack({
        //   kind: 'chapters',
        //   label: 'Chapters',
        //   src: 'https://ik.imagekit.io/zuqlyov9d/chapters.vtt',
        //   default: false,
        // }, false);
        const data = await res.text();
        chapterList = parseChaptersFromVTT(data);
      } catch (e) {
        this.player.log.warn(`Failed to fetch default chapters VTT: ${e}`);
        return;
      }
    }

    if (chapterList.length) {


      const existing = this.player.getChild('ChapterMarkersProgressBarControl');
      if (existing) {
        existing.dispose();
      }
      this.player.addChild('ChapterMarkersProgressBarControl', { chapters: chapterList });
    }
  }

  private async initRecommendationsOverlay() {
    if (!this.currentSource_) return;
    let src = Array.isArray(this.currentSource_) ? this.currentSource_[0] : this.currentSource_;
    if (!src.recommendations) return;

    const overlay = this.player.getChild('RecommendationsOverlay');
    if (overlay) overlay.dispose();
    this.player.addChild('RecommendationsOverlay', { recommendations: src.recommendations });
  }

  public getCurrentSource() {
    return this.currentSource_;
  }

  public getOriginalCurrentSource() {
    return this.originalCurrentSource_;
  }

  public getPlaylistManager() {
    return this.playlistManger_;
  }

  // Helper to get the first source object consistently
  private getFirstSource = (): SourceOptions | null => {
    if (!this.currentSource_) {
      return null;
    }
    return Array.isArray(this.currentSource_) ? this.currentSource_[0] : this.currentSource_;
  }

  // Helper to get original source object consistently
  private getOriginalFirstSource = (): SourceOptions | null => {
    if (!this.originalCurrentSource_) {
      return null;
    }
    return Array.isArray(this.originalCurrentSource_) ? this.originalCurrentSource_[0] : this.originalCurrentSource_;
  }
}

videojs.registerPlugin('imagekitVideoPlayer', ImageKitVideoPlayerPlugin);
export default ImageKitVideoPlayerPlugin;

export function videoPlayer(
  element: string | HTMLElement,
  options: PlayerOptions,
  playerOptions: any = {}
) {
  const player = videojs(element, {
    ...playerOptions,
    html5: { nativeTextTracks: false },
    plugins: {
      ...(playerOptions.plugins ?? {}),
      httpSourceSelector: { default: 'auto' },
      imagekitVideoPlayer: options,
    },
  });
  // @ts-ignore
  player.httpSourceSelector();
  // @ts-ignore
 // Explicitly handle both cases for the context menu
 if (options.hideContextMenu === true) {
  // If hiding is requested, add a listener that ONLY prevents the default menu.
  // This will disable all right-click menus on the player.
  player.on('contextmenu', (e) => {
    e.preventDefault();
  });
} else {
  // Otherwise, set up our custom, dynamic context menu.
  
  /**
   * Helper function to generate the context menu content
   * based on the player's current state.
   */
  const createContextMenuContent = () => {
    return [{
      label: player.paused() ? "Play" : "Pause",
      listener: function () {
        if (player.paused()) {
          player.play();
        } else {
          player.pause();
        }
      }
    },
    {
      label: player.loop() ? "Unloop" : "Loop",
      listener: function () {
        player.loop(!player.loop());
      }
    },
    {
      label: player.muted() ? "Unmute" : "Mute",
      listener: function () {
        player.muted(!player.muted());
      }
    },
    {
      label: player.isFullscreen() ? "Exit Fullscreen" : "Fullscreen",
      listener: function () {
        if (player.isFullscreen()) {
          player.exitFullscreen();
        } else {
          player.requestFullscreen();
        }
      }
    }];
  };

  // Initialize the context menu with the initial content.
  // The contextmenuUI plugin internally handles preventDefault for this case.
  // @ts-ignore
  player.contextmenuUI({
    content: createContextMenuContent()
  });

  // Add an event listener to update the menu content on every right-click
  player.on('contextmenu', () => {
    // @ts-ignore
    player.contextmenuUI({
        content: createContextMenuContent()
    });
  });
}

  return player;
}

export * from './interfaces';