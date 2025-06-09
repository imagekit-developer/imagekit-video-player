import type { PlayerOptions, SourceOptions, PlaylistOptions } from '../javascript';

/** Props accepted by the Angular IKVideoPlayerComponent */
export interface IKVideoPlayerProps {
    ikOptions: PlayerOptions;
    videoJsOptions?: any;
    source?: SourceOptions;
    playlist?: {
        sources: SourceOptions[];
        options?: PlaylistOptions;
    };
    className?: string;
    style?: { [key: string]: any };
}