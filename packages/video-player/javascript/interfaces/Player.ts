import type BasePlayer from 'video.js/dist/types/player';
import type { Transformation } from '@imagekit/javascript';
import type { SourceOptions } from './SourceOptions';
import type { PlaylistOptions } from './Playlist';
import type { PlaylistManager } from '../modules/playlist/playlist-manager';
import type { RemoteTextTrackOptions } from './TextTrack';

/**
 * Interface for the ImageKit Video Player plugin instance.
 * This is returned when calling player.imagekitVideoPlayer() without arguments.
 */
export interface ImageKitVideoPlayerPluginInstance {
  getPlaylistManager(): PlaylistManager | undefined;
  getOriginalCurrentSource(): SourceOptions | SourceOptions[] | null;
  getPlayerOptions(): IKPlayerOptions;
}

export interface IKPlayerOptions {
    /** Your ImageKit ID */
    imagekitId: string;
    /** 'left' | 'right' floating thumbnail when scrolled out */
    floatingWhenNotVisible?: 'left' | 'right' | null;
    /** Hide right-click context menu */
    hideContextMenu?: boolean;
    /** Logo config */
    logo?: {
        showLogo: boolean;
        logoImageUrl: string;
        logoOnclickUrl: string;
    };
    /** Enable seek thumbnails */
    seekThumbnails?: boolean;
    /** ABS (HLS/DASH) config */
    abs?: {
        protocol: 'hls' | 'dash';
        sr: number[];
    };
    /** Global ImageKit transformations */
    transformation?: Array<Transformation>;
    /** Retry attempts */
    maxTries?: number;
    /** Timeout per try in ms */
    videoTimeoutInMS?: number;
    /** Percent-based events */
    playedEventPercents?: number[];
    /** Time-based events (seconds) */
    playedEventTimes?: number[];
    /** Delay per try in ms */
    delayInMS?: number;
    /** Signer function for generating signed url */
    signerFn?: (src: string) => Promise<string>;
}

/**
 * Interface for ImageKit-specific Player methods.
 * This interface defines method overloads that prioritize ImageKit signatures.
 */
interface ImageKitPlayerMethods {
  /**
   * Overridden src method that accepts ImageKit SourceOptions.
   * This allows passing enhanced options like chapters, transformations, etc.
   * The method signature is overridden to accept SourceOptions instead of the base Video.js src format.
   * 
   * @overload ImageKit-specific signature
   */
  src(raw?: string | SourceOptions | Array<string | SourceOptions>): void;
  /**
   * Overridden addRemoteTextTrack method that accepts ImageKit RemoteTextTrackOptions.
   * This allows passing enhanced options like auto-generated subtitles, translations, etc.
   * The method signature is overridden to accept RemoteTextTrackOptions instead of the base Video.js text track format.
   * 
   * @overload ImageKit-specific signature
   */
  addRemoteTextTrack(options: RemoteTextTrackOptions, manualCleanup?: boolean): HTMLTrackElement | void;
  /**
   * Initialize the ImageKit Video Player plugin with options.
   * @param options - ImageKit player configuration options
   */
  imagekitVideoPlayer(options: IKPlayerOptions): void;
  /**
   * Get the ImageKit Video Player plugin instance.
   * Returns the plugin instance when called without arguments.
   */
  imagekitVideoPlayer(): ImageKitVideoPlayerPluginInstance;
  playlist(options: {
    sources?: SourceOptions[];
    options?: PlaylistOptions;
  }): PlaylistManager;
}

/**
 * Augmented Player type that includes ImageKit-specific methods.
 * This type extends the base Video.js Player with additional functionality.
 * 
 * Note: Method overrides (src, addRemoteTextTrack) create overloads with both
 * the base Video.js signatures and ImageKit-specific signatures. TypeScript will
 * use the most specific matching signature when calling these methods.
 */
export type Player = BasePlayer & ImageKitPlayerMethods;