import Player from 'video.js/dist/types/player';
import type { Transformation }from '@imagekit/javascript'


export interface PlayerOptions {
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


