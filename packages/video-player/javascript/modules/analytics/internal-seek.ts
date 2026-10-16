import type Player from 'video.js/dist/types/player';

const pendingInternalSeeks = new WeakSet<Player>();

/** Call right before the player seeks on its own (not user intent); analytics skips the next `seeking`/`seeked`. */
export function markInternalSeek(player: Player): void {
  pendingInternalSeeks.add(player);
}

export function consumeInternalSeek(player: Player): boolean {
  return pendingInternalSeeks.delete(player);
}
