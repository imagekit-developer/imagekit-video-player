// types/videojs-extensions.d.ts

import type { PlayerOptions } from '../interfaces';

declare module 'video.js' {
  interface Player {
    imagekitVideoPlayer(options: PlayerOptions): void;
  }

  export interface VideoJsPlayerPluginOptions {
    imagekitVideoPlayer?: PlayerOptions;
  }
}

export { }