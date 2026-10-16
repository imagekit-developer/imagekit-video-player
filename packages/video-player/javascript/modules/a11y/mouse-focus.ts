import type Player from 'video.js/dist/types/player';

/**
 * Returns a `mousedown` handler that keeps a mouse press from focusing one of our
 * keyboard-focusable controls (hotspots, product items, ...). Focus on such a control
 * means "keyboard user here": it keeps a hotspot shown and the product bar open, and
 * gives Space and the arrow keys to the control. Focus goes where a press put it
 * before these controls had a tab stop: the enclosing dialog (`tabindex="-1"`), or the
 * player itself. The click still fires.
 */
export function focusPlayerOnMouseDown(player: Player): (event: Event) => void {
  return (event: Event) => {
    event.preventDefault();
    const container = (event.target as Element | null)?.closest<HTMLElement>('[tabindex="-1"]') || (player.el() as HTMLElement);
    container.focus({ preventScroll: true });
  };
}
