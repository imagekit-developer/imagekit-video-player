import { IKPlayerOptions } from 'javascript/interfaces';
import type { ContextMenuUI } from '../modules/context-menu/types';
import type BasePlayer from 'video.js/dist/types/player';

declare module 'video.js' {
  export interface Player extends BasePlayer {
    imagekitVideoPlayer?: IKPlayerOptions;
    httpSourceSelector?: (options?: { default?: string }) => void;
    contextmenuUI?: ContextMenuUI;
    contextmenuUICleanups_?: Array<() => void>;
  }
}
