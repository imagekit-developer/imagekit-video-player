// ./context-menu-item.ts
import videojs from 'video.js';
import type Player from 'video.js/dist/types/player';
import type MenuItem from 'video.js/dist/types/menu/menu-item';
import { CleanupRegistry } from '../../utils';
import './types';

const VjsMenuItem = videojs.getComponent('MenuItem') as typeof MenuItem;

interface ContextMenuItemOptions {
  label: string;
  listener: (this: Player) => void;
  children?: unknown[];
  className?: string;
}

class ContextMenuItem extends VjsMenuItem {
  private cleanup_ = new CleanupRegistry();
  private listener_: (this: Player) => void;

  constructor(player: Player, options: ContextMenuItemOptions) {
    super(player, { 
      label: options.label,
      selectable: false,
      children: options.children,
      className: options.className
    });
    
    this.listener_ = options.listener;
  }

  handleClick(event: Event): void {
    // Parent handleClick just calls selected(true), which does nothing 
    // when selectable: false, so we skip it entirely
    
    this.listener_.call(this.player());
    
    this.cleanup_.registerTimeout(() => {
      const player = this.player() as Player & { 
        contextmenuUI?: { menu?: { dispose(): void } } 
      };
      player.contextmenuUI?.menu?.dispose();
    }, 0);
  }

  dispose(): void {
    this.cleanup_.dispose();
    super.dispose();
  }
}

videojs.registerComponent('ContextMenuItem', ContextMenuItem);

export default ContextMenuItem;