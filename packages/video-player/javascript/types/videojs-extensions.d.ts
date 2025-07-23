// types/videojs-extensions.d.ts

import type { IKPlayerOptions } from '../interfaces';

declare module 'video.js' {
  interface Player {
    imagekitVideoPlayer(options: IKPlayerOptions): void;
  }

  export interface VideoJsPlayerPluginOptions {
    imagekitVideoPlayer?: IKPlayerOptions;
  }
}

export { }