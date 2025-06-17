// ./context-menu.ts
import videojs from 'video.js';
import type Player from 'video.js/dist/types/player';
import ContextMenuItem from './context-menu-item';
import { ContextMenuItemOptions } from './types';
import './types'; // Import for module augmentation side-effects

const VjsMenu = videojs.getComponent('Menu');
const dom = videojs.dom || videojs; // For VJS5/6 compatibility
// @ts-ignore
interface ContextMenuOptions extends videojs.MenuOptions {
  content: ContextMenuItemOptions[];
  position: { left: number; top: number };
}

class ContextMenu extends VjsMenu {
  constructor(player: Player, options: ContextMenuOptions) {
    // @ts-ignore
    super(player, options);
    this.dispose = this.dispose.bind(this);

    options.content.forEach(contentItem => {
      let listener: () => void = () => {};

      if (typeof contentItem.listener === 'function') {
        listener = contentItem.listener;
      } else if (typeof contentItem.href === 'string') {
        const href = contentItem.href;
        listener = () => window.open(href);
      }
// @ts-ignore
      this.addItem(new ContextMenuItem(player, {
        // @ts-ignore
        label: contentItem.label,
        listener: listener.bind(player),
      }));
    });
  }

  createEl(): HTMLElement {
    const el = super.createEl();
    // @ts-ignore
    dom.addClass(el, 'vjs-contextmenu-ui-menu');
    const position = (this.options_ as ContextMenuOptions).position;
    // @ts-ignore
    el.style.left = `${position.left}px`;
    // @ts-ignore
    el.style.top = `${position.top}px`;
    // @ts-ignore
    return el;
  }
}
// @ts-ignore
videojs.registerComponent('ContextMenu', ContextMenu);

export default ContextMenu;