import { SourceOptions } from "./SourceOptions";

export interface AugmentedSourceOptions extends SourceOptions {
    prepared?: {
        /**
         * The source URL of the video after any transformations or processing.
         */
        src?: string;
        /**
         * chapter URL after processing.
         */
        chapter?: string;
        /**
         * Poster image URL after processing.
         */
        poster?: string;
        /**
         * seek thumbnail URL after processing.
         */
        seekThumbnail?: string;
        /**
         * playlist thumbnail URL after processing.
         */
        playlistThumbnail?: string;
        /**
         * recommendation thumbnail URLs after processing.
        */
        recommendationThumbnails?: [string]
        /**
         * shoppable thumbnail URLs after processing.
         * 
         */
        shoppableThumbnails?: [string];
        /**
        * text tracks URLs after processing.
        */
        textTracks?: {
            [key: string]: string;
        };
    }
}