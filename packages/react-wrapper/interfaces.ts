
import {
    PlayerOptions,
    SourceOptions,
    PlaylistOptions,
} from '../javascript';

/** Props accepted by IKVideoPlayer */
export interface IKVideoPlayerProps {
    /** Your ImageKit PlayerOptions */
    ikOptions: PlayerOptions;
    /** Any additional Video.js playerOptions (controls/autoplay/fluid/etc) */
    videoJsOptions?: any;
    /**
     * Exactly one of these must be provided:
     * - `source`: a single SourceOptions
     * - `playlist`: an object containing `sources: SourceOptions[]` and optional playlist `options`
     */
    source?: SourceOptions;
    playlist?: {
        sources: SourceOptions[];
        options?: PlaylistOptions;
    };
    /** Optional CSS className on the <video> element */
    className?: string;
    /** Optional inline style on the <video> element */
    style?: React.CSSProperties;
}

/** Methods exposed via ref */
export interface IKVideoPlayerRef {
    /** Returns the underlying Video.js player instance (or null if not yet mounted) */
    getPlayer: () => any | null;
}