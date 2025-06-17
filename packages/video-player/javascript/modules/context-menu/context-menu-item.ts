// ./context-menu-item.ts
import videojs from 'video.js';
import type Player from 'video.js/dist/types/player';
import './types'; // Import for module augmentation side-effects

const VjsMenuItem = videojs.getComponent('MenuItem');
// @ts-ignore
interface ContextMenuItemOptions extends videojs.MenuItemOptions {
  listener: (this: Player) => void;
}

class ContextMenuItem extends VjsMenuItem {
  constructor(player: Player, options: ContextMenuItemOptions) {
    // Ensure menu items are not selectable to avoid focus issues.
    // @ts-ignore
    super(player, { ...options, selectable: false });
    // Bind the listener from options to the component instance
    this.options_.listener = options.listener;
  }
// @ts-ignore
  handleClick(event: videojs.EventTarget.Event): void {
    // @ts-ignore
    super.handleClick(event);

    // Execute the listener provided in the options.
    (this.options_ as ContextMenuItemOptions).listener.call(this.player());

    // Close the containing menu after the current call stack clears.
    window.setTimeout(() => {
      // Safely access the menu via optional chaining.
      // @ts-ignore
      this.player().contextmenuUI?.menu?.dispose();
    }, 1);
  }
}
// @ts-ignore
videojs.registerComponent('ContextMenuItem', ContextMenuItem);

export default ContextMenuItem;