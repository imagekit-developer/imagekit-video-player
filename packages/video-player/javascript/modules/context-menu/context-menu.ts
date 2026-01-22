// ./context-menu.ts
import videojs from 'video.js';
import type Player from 'video.js/dist/types/player';
import type Menu from 'video.js/dist/types/menu/menu';
import ContextMenuItem from './context-menu-item';
import { ContextMenuItemOptions } from './types';
import './types';

const VjsMenu = videojs.getComponent('Menu') as typeof Menu;

interface ContextMenuOptions {
  content: ContextMenuItemOptions[];
  position: { left: number; top: number };
  children?: any[];
  className?: string;
}

class ContextMenu extends VjsMenu {
  constructor(player: Player, options: ContextMenuOptions) {
    super(player, options);

    // Build menu items from content
    options.content.forEach(contentItem => {
      // Determine listener function
      const listener: (this: Player) => void = 
        typeof contentItem.listener === 'function'
          ? contentItem.listener
          : typeof contentItem.href === 'string'
            ? function() { window.open(contentItem.href); }
            : function() { /* no-op */ };

      // Add menu item
      this.addItem(
        new ContextMenuItem(player, {
          label: contentItem.label,
          listener: listener.bind(player),
        })
      );
    });
  }

  createEl(): HTMLElement {
    const el = super.createEl() as HTMLElement;
    
    // Add CSS class
    el.classList.add('vjs-contextmenu-ui-menu');
    
    // Set position
    const position = (this.options_ as ContextMenuOptions).position;
    el.style.left = `${position.left}px`;
    el.style.top = `${position.top}px`;
    
    return el;
  }
}

videojs.registerComponent('ContextMenu', ContextMenu);

export default ContextMenu;