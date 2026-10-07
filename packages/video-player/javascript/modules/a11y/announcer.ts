import type Player from 'video.js/dist/types/player';

const ANNOUNCER_CLASS = 'vjs-ik-announcer';

/**
 * Announces a message to screen readers through a visually hidden polite live
 * region, one per player (WCAG 4.1.3 Status Messages). Use it for changes that
 * happen without the user asking, e.g. "Up next" appearing or an auto-advance
 * countdown starting.
 */
export function announce(player: Player, message: string): void {
  const playerEl = player.el() as HTMLElement | null;
  if (!playerEl) return;

  let region = playerEl.querySelector<HTMLElement>(`:scope > .${ANNOUNCER_CLASS}`);
  if (!region) {
    region = document.createElement('div');
    // Visually hidden via announcer.css (Video.js's .vjs-control-text only applies to nested controls).
    region.className = ANNOUNCER_CLASS;
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', 'polite');
    region.setAttribute('aria-atomic', 'true');
    playerEl.appendChild(region);
  }

  // Clear first so repeating the same message is announced again.
  region.textContent = '';
  const target = region;
  window.setTimeout(() => {
    target.textContent = message;
  }, 50);
}
