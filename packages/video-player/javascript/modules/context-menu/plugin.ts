// ./plugin.ts
import videojs from 'video.js';
import type Player from 'video.js/dist/types/player';

import ContextMenu from './context-menu';
import { getPointerPosition } from './utils';
import { PluginOptions } from './types';
import './types'; // Import for module augmentation side-effects

function hasMenu(player: Player): boolean {
    // @ts-ignore
    return !!(player.contextmenuUI && player.contextmenuUI.menu && player.contextmenuUI.menu.el());
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

function onContextMenu(this: Player, e: MouseEvent): void {
    e.preventDefault();
    // @ts-ignore
    if (!this.contextmenuUI) {
        return;
    }

    // @ts-ignore
    if (hasMenu(this)) {
        // @ts-ignore
        this.contextmenuUI.menu!.dispose();
        return;
    }
    // @ts-ignore
    if (!(e.target instanceof Element) || this.contextmenuUI.options_.excludeElements(e.target)) {
        return;
    }


    // @ts-ignore
    const pointerPosition = getPointerPosition(this.el(), e);
    const playerRect = this.el().getBoundingClientRect();
    // @ts-ignore
    const menuPosition = findMenuPosition(pointerPosition, playerRect);
    const documentEl = videojs.browser.IS_FIREFOX ? document.documentElement : document;

    const menu = new ContextMenu(this, {
        // @ts-ignore
        content: this.contextmenuUI.content,
        position: menuPosition
    });
    // @ts-ignore
    this.contextmenuUI.menu = menu;

    // @ts-ignore
    this.contextmenuUI.closeMenu = () => {
        videojs.log.warn('player.contextmenuUI.closeMenu() is deprecated, please use player.contextmenuUI.menu.dispose() instead!');
        menu.dispose();
    };

    menu.on('dispose', () => {
        videojs.off(documentEl, ['click', 'tap'], menu.dispose);
        this.removeChild(menu);
        // @ts-ignore
        if (this.contextmenuUI) {
            // @ts-ignore
            delete this.contextmenuUI.menu;
        }
    });

    this.addChild(menu);

    const menuRect = menu.el().getBoundingClientRect();
    const bodyRect = document.body.getBoundingClientRect();
    // @ts-ignore
    if (this.contextmenuUI.keepInside || menuRect.right > bodyRect.width || menuRect.bottom > bodyRect.height) {
        // FIX: The original code had `this.player_`, which is incorrect. `this` is the player.
        const constrainedLeft = Math.min(menuPosition.left, this.currentWidth() - menu.currentWidth());
        const constrainedTop = Math.min(menuPosition.top, this.currentHeight() - menu.currentHeight());
        // @ts-ignore
        menu.el().style.left = `${Math.floor(constrainedLeft)}px`;
        // @ts-ignore
        menu.el().style.top = `${Math.floor(constrainedTop)}px`;
    }

    videojs.on(documentEl, ['click', 'tap'], menu.dispose);
}

function contextmenuUI(this: Player, options: PluginOptions): void {
    const defaults: Partial<PluginOptions> = {
        keepInside: true,
        excludeElements
    };

    const mergedOptions = videojs.mergeOptions(defaults, options) as Required<PluginOptions>;

    if (!Array.isArray(mergedOptions.content)) {
        throw new Error('"content" option is required and must be an array');
    }

    // Teardown previous instance if it exists, preserving original logic
    // @ts-ignore
    if (this.contextmenuUI) {
        // @ts-ignore
        this.contextmenuUI.menu?.dispose();
        // @ts-ignore
        this.off('contextmenu', this.contextmenuUI.onContextMenu);
        // @ts-ignore
        delete this.contextmenuUI;
    }

    // Create a callable function that also serves as the plugin's state namespace.
    const cmui = ((opts: PluginOptions) => {
        contextmenuUI.call(this, opts);
        // @ts-ignore
    }) as typeof this.contextmenuUI;
    // @ts-ignore
    this.contextmenuUI = cmui;

    // Assign properties to the new plugin instance
    // @ts-ignore
    this.contextmenuUI.options_ = mergedOptions;
    // @ts-ignore
    this.contextmenuUI.content = mergedOptions.content;
    // @ts-ignore
    this.contextmenuUI.keepInside = mergedOptions.keepInside;
    // @ts-ignore
    this.contextmenuUI.onContextMenu = onContextMenu.bind(this);

    // @ts-ignore
    this.on('contextmenu', this.contextmenuUI.onContextMenu);
    this.ready(() => this.addClass('vjs-contextmenu-ui'));
}

videojs.registerPlugin('contextmenuUI', contextmenuUI);

export default contextmenuUI;