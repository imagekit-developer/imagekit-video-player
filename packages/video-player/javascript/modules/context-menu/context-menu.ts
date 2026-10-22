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

    this.contentEl().setAttribute('aria-label', this.localize('Player options'));

    // Keyboard support on top of Video.js's Menu (which handles the arrow keys).
    // Capture phase: Video.js menu items stop Home/End before they would bubble here.
    (this.el() as HTMLElement).addEventListener('keydown', this.handleMenuKeys_, true);

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

  private handleMenuKeys_ = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' || event.key === 'Tab') {
      // Close; the plugin returns focus to where it was before the menu opened.
      event.preventDefault();
      event.stopPropagation();
      this.dispose();
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      event.stopPropagation();
      this.focus(event.key === 'Home' ? 0 : this.children().length - 1);
    }
  };

  /** Whether keyboard focus was inside the menu when it closed (read in 'dispose' handlers). */
  focusWasInside = false;

  dispose(): void {
    const el = this.el() as HTMLElement | null;
    // Record before removal: Chrome moves focus away as soon as the element is detached.
    this.focusWasInside = !!el && el.contains(document.activeElement);
    el?.removeEventListener('keydown', this.handleMenuKeys_, true);
    super.dispose();
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