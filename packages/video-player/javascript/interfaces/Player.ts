import type BasePlayer from 'video.js/dist/types/player';
import type { Transformation } from '@imagekit/javascript';
import type { SourceOptions } from './SourceOptions';
import type { PlaylistOptions } from './Playlist';
import type { PlaylistManager } from '../modules/playlist/playlist-manager';

/**
 * Interface for the ImageKit Video Player plugin instance.
 * This is returned when calling player.imagekitVideoPlayer() without arguments.
 */
export interface ImageKitVideoPlayerPluginInstance {
  getPlaylistManager(): PlaylistManager | undefined;
  getOriginalCurrentSource(): SourceOptions | null;
  getPlayerOptions(): IKPlayerOptions;
}

export interface AnalyticsConfig {
    enabled?: boolean;
    user_id?: string;
    customDimensions?: Record<string, string>;
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
    /** Delay per try in ms */
    delayInMS?: number;
    /** Signer function for generating signed url */
    signerFn?: (src: string) => Promise<string>;
    /** Analytics configuration */
    analytics?: AnalyticsConfig;
}

/**
 * Interface for ImageKit-specific Player methods.
 * This interface defines method overloads that prioritize ImageKit signatures.
 */
interface ImageKitPlayerMethods {
  /**
   * Overridden src method that accepts ImageKit SourceOptions.
   * This allows passing enhanced options like chapters, transformations, etc.
   * 
   * @param source - ImageKit source options object
   */
  src(source?: SourceOptions): void | string;
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
 * Note: The src method is overridden to accept ImageKit SourceOptions.
 */
export type Player = BasePlayer & ImageKitPlayerMethods;