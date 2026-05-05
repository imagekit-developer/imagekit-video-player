// ./plugin.ts
import videojs from 'video.js';
import type Player from 'video.js/dist/types/player';
import type Component from 'video.js/dist/types/component';

import ContextMenu from './context-menu';
import { getPointerPosition } from './utils';
import { PluginOptions, ContextMenuUI } from './types';
import { addEventListener } from '../../utils';
import './types'; // Import for module augmentation side-effects

// Extended Player type with contextmenuUI plugin properties
type PlayerWithContextMenu = Player & {
    contextmenuUI?: ContextMenuUI;
    contextmenuUICleanups_?: Array<() => void>;
};

// Type guard to check if contextmenuUI property exists (may not be initialized)
function hasContextMenuUI(player: Player): player is PlayerWithContextMenu & { contextmenuUI: ContextMenuUI } {
    const playerWithContextMenu = player as PlayerWithContextMenu;
    return playerWithContextMenu.contextmenuUI !== undefined;
}

// Check if the plugin is properly initialized (has required properties)
function isContextMenuUIInitialized(player: PlayerWithContextMenu): boolean {
    if (!hasContextMenuUI(player)) {
        return false;
    }
    const plugin = player.contextmenuUI;
    return typeof plugin.onContextMenu === 'function' &&
        typeof plugin.createContextMenuContent === 'function';
}

function hasMenu(player: PlayerWithContextMenu): boolean {
    return hasContextMenuUI(player) &&
        player.contextmenuUI.menu !== undefined &&
        player.contextmenuUI.menu.el() !== null;
}

function excludeElements(targetEl: Element): boolean {
    const tagName = targetEl.tagName.toLowerCase();
    return tagName === 'input' || tagName === 'textarea';
}

function findMenuPosition(pointerPosition: { x: number; y: number }, playerSize: { width: number; height: number }): { left: number; top: number } {
    // This standard calculation positions the menu's top-left corner at the pointer.
    return {
        left: Math.round(playerSize.width * pointerPosition.x),
        top: Math.round(playerSize.height * pointerPosition.y)
    };
}

function onContextMenu(this: PlayerWithContextMenu, e: MouseEvent): void {
    // Always prevent default to block native menu - must be first!
    e.preventDefault();
    e.stopPropagation();

    if (!hasContextMenuUI(this)) {
        return;
    }

    // If menu already exists, close it and return
    // preventDefault already called above, so native menu won't show
    if (hasMenu(this)) {
        this.contextmenuUI.menu!.dispose();
        return;
    }

    if (!(e.target instanceof HTMLElement) || excludeElements(e.target)) {
        return;
    }

    const playerEl = this.el();
    if (!playerEl || !(playerEl instanceof HTMLElement)) {
        return;
    }

    const pointerPosition = getPointerPosition(playerEl, e);
    const playerRect = playerEl.getBoundingClientRect();
    const menuPosition = findMenuPosition(pointerPosition, playerRect);
    const documentEl = videojs.browser.IS_FIREFOX ? document.documentElement : document;

    // Get fresh content by calling the function
    const content = this.contextmenuUI.createContextMenuContent(this);

    const menu = new ContextMenu(this, {
        content: content,
        position: menuPosition
    });
    this.contextmenuUI.menu = menu;

    this.contextmenuUI.closeMenu = () => {
        videojs.log.warn('player.contextmenuUI.closeMenu() is deprecated, please use player.contextmenuUI.menu.dispose() instead!');
        menu.dispose();
    };

    // Store document listener cleanup function
    if (!this.contextmenuUICleanups_) {
        this.contextmenuUICleanups_ = [];
    }
    const handleMenuClose = (evt: Event) => {
        menu.dispose();
    };

    const documentCleanup = addEventListener(documentEl, 'click', handleMenuClose);
    const tapCleanup = addEventListener(documentEl, 'tap', handleMenuClose);
    this.contextmenuUICleanups_.push(documentCleanup, tapCleanup);

    menu.on('dispose', () => {
        // Clean up document listeners
        if (this.contextmenuUICleanups_) {
            this.contextmenuUICleanups_.forEach(cleanup => cleanup());
            this.contextmenuUICleanups_ = [];
        }
        // Type assertion for Video.js component methods
        (this as unknown as Component).removeChild(menu);

        if (hasContextMenuUI(this)) {
            delete this.contextmenuUI.menu;
        }
    });

    // Type assertion for Video.js component methods
    (this as unknown as Component).addChild(menu);

    const menuEl = menu.el();
    if (!menuEl || !(menuEl instanceof HTMLElement)) {
        return;
    }


    // Type assertions for Video.js component methods
    const playerComponent = this as unknown as Component;
    const currentWidth = typeof playerComponent.currentWidth === 'function'
        ? playerComponent.currentWidth()
        : playerEl.offsetWidth;
    const currentHeight = typeof playerComponent.currentHeight === 'function'
        ? playerComponent.currentHeight()
        : playerEl.offsetHeight;
    const menuWidth = typeof menu.currentWidth === 'function'
        ? menu.currentWidth()
        : menuEl.offsetWidth;
    const menuHeight = typeof menu.currentHeight === 'function'
        ? menu.currentHeight()
        : menuEl.offsetHeight;

    // Always constrain menu to stay within player bounds

    const constrainedLeft = Math.min(menuPosition.left, currentWidth - menuWidth);
    const constrainedTop = Math.min(menuPosition.top, currentHeight - menuHeight);
    menuEl.style.left = `${Math.floor(constrainedLeft)}px`;
    menuEl.style.top = `${Math.floor(constrainedTop)}px`;

}

function contextmenuUI(this: PlayerWithContextMenu, options: PluginOptions): void {
    if (typeof options.createContextMenuContent !== 'function') {
        throw new Error('"createContextMenuContent" option is required and must be a function');
    }

    // Check if plugin is properly initialized (not just if property exists)
    if (isContextMenuUIInitialized(this)) {
        // Plugin is properly initialized, just update the content function
        const pluginState = this.contextmenuUI!;
        pluginState.createContextMenuContent = options.createContextMenuContent;
        pluginState.options_ = options;
        return;
    } else if (hasContextMenuUI(this)) {
        // Plugin property exists but is not properly initialized - re-initialize
        // Clean up the incomplete plugin state
        if (this.contextmenuUICleanups_) {
            this.contextmenuUICleanups_.forEach(cleanup => cleanup());
            this.contextmenuUICleanups_ = undefined;
        }
        // Use type assertion to allow deletion of optional property
        const playerWithOptional = this as PlayerWithContextMenu;
        playerWithOptional.contextmenuUI = undefined;
        // Fall through to initialization below
    }

    // Teardown any orphaned state if it exists
    if (this.contextmenuUICleanups_) {
        this.contextmenuUICleanups_.forEach(cleanup => cleanup());
        delete this.contextmenuUICleanups_;
    }

    // Create a callable function that also serves as the plugin's state namespace.
    const cmui = ((opts: PluginOptions) => {
        contextmenuUI.call(this, opts);
    }) as ContextMenuUI;

    // Assign the function to the player
    this.contextmenuUI = cmui;

    // Assign properties to the new plugin instance
    cmui.options_ = options;
    cmui.createContextMenuContent = options.createContextMenuContent;
    cmui.onContextMenu = onContextMenu.bind(this);

    // Store contextmenu listener cleanup
    if (!this.contextmenuUICleanups_) {
        this.contextmenuUICleanups_ = [];
    }

    if (hasContextMenuUI(this)) {
        this.on('contextmenu', this.contextmenuUI.onContextMenu);
    }

    this.ready(() => {
        const playerComponent = this as unknown as Component;
        if (typeof playerComponent.addClass === 'function') {
            playerComponent.addClass('vjs-contextmenu-ui');
        }
    });
}

videojs.registerPlugin('contextmenuUI', contextmenuUI);

export default contextmenuUI;