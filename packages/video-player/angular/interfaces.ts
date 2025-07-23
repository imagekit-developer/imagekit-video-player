import type { IKPlayerOptions, SourceOptions, PlaylistOptions } from '../javascript';

/** Props accepted by the Angular IKVideoPlayerComponent */
export interface IKVideoPlayerProps {
    ikOptions: IKPlayerOptions;
    videoJsOptions?: any;
    source?: SourceOptions;
    playlist?: {
        sources: SourceOptions[];
        options?: PlaylistOptions;
    };
}