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
    contextmenuUIKeyCleanup_?: () => void;
};

// Set when the menu was opened from the keyboard, so a native `contextmenu` event the
// browser may fire for the same key press is ignored instead of closing the menu again.
const KEY_OPEN_GRACE_MS = 500;
const lastKeyOpen = new WeakMap<Player, number>();

/**
 * Keyboard shortcuts that open the menu: the Menu key and Shift+F10. Browsers only turn
 * these into a `contextmenu` event on Windows/Linux, so we handle them ourselves and
 * the menu also opens from a Mac keyboard (WCAG 2.1.1).
 */
function isMenuKey(e: KeyboardEvent): boolean {
    return e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey);
}

/**
 * Menu position for a keyboard-opened menu: at the focused control, or the player's
 * centre, since there is no pointer position.
 */
function keyboardMenuPosition(playerEl: HTMLElement): { left: number; top: number } {
    const playerRect = playerEl.getBoundingClientRect();
    const active = document.activeElement;
    if (active instanceof HTMLElement && active !== playerEl && playerEl.contains(active)) {
        const rect = active.getBoundingClientRect();
        return { left: Math.round(rect.left - playerRect.left), top: Math.round(rect.top - playerRect.top) };
    }
    return { left: Math.round(playerRect.width / 2), top: Math.round(playerRect.height / 2) };
}

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

    // Keyboard-generated contextmenu events (the Menu key handled natively) report
    // button -1; a real right-click reports 2.
    const fromKeyboard = e.button === -1;
    const duplicateOfKeyOpen = fromKeyboard && performance.now() - (lastKeyOpen.get(this) ?? -Infinity) < KEY_OPEN_GRACE_MS;

    // If menu already exists, close it and return
    // preventDefault already called above, so native menu won't show
    if (hasMenu(this)) {
        // ...unless we just opened it from the keyboard and this is the browser's own
        // event for the same key press.
        if (!duplicateOfKeyOpen) this.contextmenuUI.menu!.dispose();
        return;
    }

    if (!(e.target instanceof HTMLElement) || excludeElements(e.target)) {
        return;
    }

    const playerEl = this.el();
    if (!playerEl || !(playerEl instanceof HTMLElement)) {
        return;
    }

    if (fromKeyboard) {
        openMenu(this, keyboardMenuPosition(playerEl), true);
        return;
    }
    const pointerPosition = getPointerPosition(playerEl, e);
    const playerRect = playerEl.getBoundingClientRect();
    openMenu(this, findMenuPosition(pointerPosition, playerRect), false);
}

/**
 * Opens the menu from the keyboard (Menu key / Shift+F10) while focus is in the player.
 */
function onMenuKey(this: PlayerWithContextMenu, e: KeyboardEvent): void {
    if (!isMenuKey(e) || !hasContextMenuUI(this)) return;
    if (e.target instanceof HTMLElement && excludeElements(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    lastKeyOpen.set(this, performance.now());
    if (hasMenu(this)) {
        this.contextmenuUI.menu!.dispose();
        return;
    }
    const playerEl = this.el() as HTMLElement;
    openMenu(this, keyboardMenuPosition(playerEl), true);
}

/**
 * Builds and shows the menu at `menuPosition` (relative to the player). From the
 * keyboard, focus moves to the first item, and goes back to the previously focused
 * element when the menu closes.
 */
function openMenu(player: PlayerWithContextMenu, menuPosition: { left: number; top: number }, fromKeyboard: boolean): void {
    if (!hasContextMenuUI(player)) return;
    const playerEl = player.el() as HTMLElement;
    const returnFocusEl = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    buildMenu.call(player, playerEl, menuPosition);
    const menu = player.contextmenuUI!.menu;
    if (!menu) return;

    menu.on('dispose', () => {
        // Restore focus only if it was in the menu (keyboard use); a mouse user who
        // closes it by clicking elsewhere keeps focus where that click put it.
        if (!menu.focusWasInside) return;
        const target = returnFocusEl && returnFocusEl.isConnected && returnFocusEl.offsetParent !== null ? returnFocusEl : playerEl;
        target.focus();
    });

    if (fromKeyboard) menu.focus(0);
}

function buildMenu(this: PlayerWithContextMenu, playerEl: HTMLElement, menuPosition: { left: number; top: number }): void {
    if (!hasContextMenuUI(this)) return;
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
    // Escape closes the menu even when focus isn't in it (e.g. opened with the mouse).
    const escapeCleanup = addEventListener(document, 'keydown', ((evt: KeyboardEvent) => {
        if (evt.key === 'Escape') menu.dispose();
    }) as EventListener);
    this.contextmenuUICleanups_.push(documentCleanup, tapCleanup, escapeCleanup);

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

    // Menu key / Shift+F10. Capture phase: Video.js controls stop most keys before they
    // would bubble up to the player element.
    const playerEl = this.el() as HTMLElement | null;
    if (playerEl) {
        this.contextmenuUIKeyCleanup_?.();
        const keyHandler = onMenuKey.bind(this);
        playerEl.addEventListener('keydown', keyHandler, true);
        this.contextmenuUIKeyCleanup_ = () => playerEl.removeEventListener('keydown', keyHandler, true);
        this.one('dispose', () => this.contextmenuUIKeyCleanup_?.());
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