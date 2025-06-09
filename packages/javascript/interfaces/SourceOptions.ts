import type { PosterOptions } from './Poster';
import type { ABSOptions } from './ABSOptions';
import type { Transformation } from '@imagekit/javascript'
import type { RemoteTextTrackOptions } from './TextTrack';
import type { ShoppableProps } from './Shoppable';

export interface VideoInfo {
    title?: string;
    subtitle?: string;
    description?: string;
}

/**
 * The options object you can pass to `player.src({...})`.
 */
export interface SourceOptions {

    /**
     * The source URL of the video.
     */
    src: string;
    /**
     * Chapters configuration.
     * - `true` to auto-generate (AI) chapters
     * - `{ url: string }` to load from a VTT file
     * - `{ [timeInSec]: title }` to define manually
     */
    chapters?: boolean | { url: string } | Record<number, string>;

    /**
     * Display metadata like title/subtitle in playlists or recommendations.
     */
    info?: VideoInfo;

    /**
     * Poster image config (overrides any global setting).
     */
    poster?: PosterOptions;

    /**
     * Adaptive-bitrate streaming config (HLS or MPEG-DASH).
     */
    abs?: ABSOptions;

    /**
     * One-or-more ImageKit transformation steps to apply to this source.
     */
    transformation?: Transformation[];

    /**
     * A set of up to four recommendations to show in the overlay when this video ends.
     */
    recommendations?: SourceOptions[];

    /**
     * Shoppable video configuration for this source.
     */
    shoppable?: ShoppableProps;

    /**
     * One-or-more text tracks for captions/subtitles on this source.
     */
    textTracks?: RemoteTextTrackOptions[];
}
