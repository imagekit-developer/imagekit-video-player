import type Player from 'video.js/dist/types/player';
import type { CleanupRegistry } from '../../utils';

const EDGE_MARGIN_PX = 4;
const MENU_BUTTON = '.vjs-control-bar > .vjs-menu-button-popup';

/**
 * Video.js centres a popup menu over its button and never checks the player's edges, so a
 * wide menu (e.g. a long caption label) is cut off by the player's overflow clipping.
 * Opening a menu shifts it sideways, through --ik-menu-shift, back inside the player.
 */
export function setupMenuPlacement(player: Player, cleanup: CleanupRegistry): void {
  const playerEl = player.el() as HTMLElement;
  const controlBarEl = player.getChild('ControlBar')?.el() as HTMLElement | undefined;
  if (!controlBarEl) {
    return;
  }

  const place = (buttonEl: Element) => {
    const menu = buttonEl.querySelector<HTMLElement>(':scope > .vjs-menu');
    const content = menu?.querySelector<HTMLElement>('.vjs-menu-content');
    if (!menu || !content) {
      return;
    }

    const bounds = playerEl.getBoundingClientRect();
    menu.style.setProperty('--ik-menu-max-width', `${Math.max(0, bounds.width - 2 * EDGE_MARGIN_PX)}px`);
    menu.style.removeProperty('--ik-menu-shift');
    menu.style.removeProperty('--ik-menu-max-height');

    const rect = content.getBoundingClientRect();
    if (rect.width === 0) {
      return;
    }

    // The menu grows upwards from the control bar, so a short player scrolls it instead.
    const heightOverflow = bounds.top + EDGE_MARGIN_PX - rect.top;
    if (heightOverflow > 0) {
      menu.style.setProperty('--ik-menu-max-height', `${Math.max(0, rect.height - heightOverflow)}px`);
    }

    let shift = 0;
    if (rect.right > bounds.right - EDGE_MARGIN_PX) {
      shift = bounds.right - EDGE_MARGIN_PX - rect.right;
    }
    if (rect.left + shift < bounds.left + EDGE_MARGIN_PX) {
      shift = bounds.left + EDGE_MARGIN_PX - rect.left;
    }
    if (shift !== 0) {
      menu.style.setProperty('--ik-menu-shift', `${shift}px`);
    }
  };

  // The menu is only displayed once the hover/focus/click has applied, so measure a frame later.
  const placeAfterOpen = (event: Event) => {
    const buttonEl = (event.target as Element | null)?.closest(MENU_BUTTON);
    if (buttonEl) {
      requestAnimationFrame(() => place(buttonEl));
    }
  };

  const placeOpenMenus = () => {
    controlBarEl.querySelectorAll(MENU_BUTTON).forEach((buttonEl) => {
      if (buttonEl.querySelector(':scope > .vjs-menu')?.getBoundingClientRect().width) {
        place(buttonEl);
      }
    });
  };

  ['mouseover', 'focusin', 'click'].forEach((eventName) => {
    cleanup.registerEventListener(controlBarEl, eventName, placeAfterOpen);
  });
  cleanup.registerVideoJsListener(player, 'playerresize', placeOpenMenus);
  cleanup.registerVideoJsListener(player, 'fullscreenchange', placeOpenMenus);
}
