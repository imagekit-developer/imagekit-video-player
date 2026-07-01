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
  /**
   * Report a non-fatal application-level error to analytics WITHOUT putting the
   * player into an error state. Playback is unaffected. The error flows through
   * the configured `mapError` callback (if any) before being shipped. Severity
   * classification is handled server-side by the dashboard from the `code`.
   *
   * Typical use cases: subtitle/thumbnail load failures, signing endpoint
   * failures before playback starts, recoverable CDN fallbacks, business
   * exceptions that the application wants visibility into.
   *
   * No-op when analytics is disabled.
   */
  reportError(error: ReportableError): void;
}

/** The shape returned by `mapError`. All fields are optional — omitted fields keep their original value. */
export interface MappedError {
    code?: string;
    message?: string;
    context?: string;
}

/** The error info passed into `mapError`. */
export interface RawPlayerError {
    code: string;
    message?: string;
    context?: string;
}

/**
 * Manually-reported error payload supplied to `player.imagekitVideoPlayer().reportError()`.
 * Severity classification is performed server-side from the `code` — do not embed severity here.
 */
export interface ReportableError {
    /** Stable identifier the dashboard maps to a severity bucket. */
    code: string;
    /** Human-readable description, free-form. */
    message?: string;
    /** Free-form structured context (will be passed through `mapError`). */
    context?: string;
}

export interface AnalyticsConfig {
    enabled?: boolean;
    userId?: string;
    customDimensions?: Record<string, string>;
    /**
     * Optional pure function called on every error before it is reported to analytics.
     * Use it to remap or enrich error codes/messages with your own classification.
     *
     * @example
     * mapError: (err) => {
     *   try {
     *     const ctx = JSON.parse(err.context || '{}');
     *     // For HLS/DASH errors, ctx.metadata.errorType is something like
     *     // 'networkrequestfailed' or 'networkrequesttimeout'.
     *     if (ctx.metadata?.errorType) {
     *       return { code: ctx.metadata.errorType };
     *     }
     *   } catch { }
     * }
     */
    mapError?: (error: RawPlayerError) => MappedError | undefined | null;
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