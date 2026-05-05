// ./types.ts
import type Player from 'video.js/dist/types/player';
import type ContextMenu from './context-menu';

/**
 * Interface for a single menu item object provided in the plugin's options.
 */
export interface ContextMenuItemOptions {
  label: string;
  listener?: (this: Player) => void;
  href?: string;
}

/**
 * Interface for the options object passed to the main plugin function.
 */
export interface PluginOptions {
  createContextMenuContent: (player: Player) => ContextMenuItemOptions[];
}

/**
 * Describes the `contextmenuUI` object that will be attached to the Player instance.
 * It's both a callable function (for re-initialization) and an object holding state.
 */
export interface ContextMenuUI {
  (options: PluginOptions): void;
  createContextMenuContent: (player: Player) => ContextMenuItemOptions[];
  options_: PluginOptions;
  onContextMenu: (e: MouseEvent) => void;
  menu?: ContextMenu;
  closeMenu?: () => void; // Deprecated but kept for compatibility
}

/**
 * Module augmentation for contextmenuUI has been moved to
 * packages/video-player/javascript/types/videojs-extensions.d.ts
 * to consolidate all Video.js Player augmentations in one place.
 */