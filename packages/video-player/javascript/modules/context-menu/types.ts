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
  content: ContextMenuItemOptions[];
  keepInside?: boolean;
  excludeElements?: (targetEl: Element) => boolean;
}

/**
 * Describes the `contextmenuUI` object that will be attached to the Player instance.
 * It's both a callable function (for re-initialization) and an object holding state.
 */
export interface ContextMenuUI {
  (options: PluginOptions): void;
  content: ContextMenuItemOptions[];
  keepInside: boolean;
  options_: Required<PluginOptions>;
  onContextMenu: (e: MouseEvent) => void;
  menu?: ContextMenu;
  closeMenu?: () => void; // Deprecated but kept for compatibility
}

/**
 * Use module augmentation to teach TypeScript about the `contextmenuUI` plugin
 * on the Video.js Player interface. This is the key to removing many errors.
 * The property is marked as optional (`?`) to allow it to be added and deleted dynamically.
 */
declare module 'video.js' {
  interface Player {
    contextmenuUI?: ContextMenuUI;
  }
}