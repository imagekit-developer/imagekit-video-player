import {
    Component,
    Input,
    ViewChild,
    ElementRef,
    OnChanges,
    OnDestroy,
    SimpleChanges,
  } from '@angular/core';
  import { CommonModule } from '@angular/common'; // <-- 1. IMPORT CommonModule
  // import { videoPlayer } from '../javascript';
  import type { IKVideoPlayerProps } from './interfaces';
  import type Player from 'video.js/dist/types/player';
// import { PlayerOptions } from 'javascript';
import videojs from 'video.js';

// import type { Transformation }from '@imagekit/javascript'


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
    transformation?: Array<String>;
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




@Component({
  selector: 'ik-video-player',
  templateUrl: './ik-video-player.component.html',
  standalone: true, // <-- 2. ADD this line
  imports: [CommonModule], // <-- 3. ADD this line
})
export class IkVideoPlayerComponent implements OnChanges, OnDestroy {
  @Input() ikOptions!: IKVideoPlayerProps['ikOptions'];
  @Input() videoJsOptions: IKVideoPlayerProps['videoJsOptions'] = {};
  @Input() source?: IKVideoPlayerProps['source'];
  @Input() playlist?: IKVideoPlayerProps['playlist'];
  @Input() className?: IKVideoPlayerProps['className'];
  @Input() style?: IKVideoPlayerProps['style'];

  // Get a reference to the <video> element from the template
  @ViewChild('videoPlayerElement', { static: true })
  videoElement!: ElementRef<HTMLVideoElement>;

  private player?: Player;

  // This lifecycle hook runs whenever an @Input() property changes.
  // It's the equivalent of React's useEffect with a dependency array.
  ngOnChanges(changes: SimpleChanges): void {
    // We only want to re-initialize the player if the core options change,
    // just like in the React wrapper.
    if (changes['ikOptions'] || changes['videoJsOptions']) {
      this.initializePlayer();
    }
  }

  private initializePlayer(): void {
    // Dispose the old player instance if it exists, to prevent memory leaks
    if (this.player) {
      this.player.dispose();
    }

    if (!this.videoElement?.nativeElement) return;

    // Initialize the player
    this.player = videoPlayer(
      this.videoElement.nativeElement,
      this.ikOptions,
      this.videoJsOptions
    );

    // If both source and playlist are provided, warn and pick playlist
    if (this.source && this.playlist) {
      console.warn(
        '[IKVideoPlayer] Both `source` and `playlist` were provided. Using `playlist`.'
      );
    }

    // Apply playlist or source
    if (this.playlist && Array.isArray(this.playlist.sources) && this.playlist.sources.length > 0) {
      const playlistMgr = (this.player as any).playlist({
        sources: this.playlist.sources,
        options: this.playlist.options || {},
      });
      playlistMgr.loadFirstItem();
    } else if (this.source) {
      this.player.src(this.source);
    }

  }

  // This is the public method that parent components can call.
  // It's the equivalent of the `getPlayer` ref method in the React wrapper.
  public getPlayer(): Player | undefined {
    return this.player;
  }

  // This lifecycle hook runs when the component is removed from the DOM.
  ngOnDestroy(): void {
    if (this.player) {
      this.player.dispose();
    }
  }
}

function videoPlayer(nativeElement: HTMLVideoElement, ikOptions: PlayerOptions, videoJsOptions: any): Player {
  const player = videojs(nativeElement, videoJsOptions);

  // Apply ImageKit-specific options if provided
  if (ikOptions) {
    // Example: Set custom attributes or configurations
    console.log(ikOptions)
  }

  return player;
}
