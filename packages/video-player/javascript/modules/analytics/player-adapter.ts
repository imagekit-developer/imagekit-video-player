/**
 * Adapts Video.js player events to normalized analytics signals.
 * Subscribes to player runtime events and invokes callbacks for the analytics tracker.
 */
import type Player from 'video.js/dist/types/player';
import type { CleanupRegistry } from '../../utils';
import type { SourceOptions } from '../../interfaces';

export type AdapterSignal =
  | { type: 'player_ready' }
  | { type: 'load_start'; source: SourceOptions | null }
  | { type: 'play' }
  | { type: 'playing' }
  | { type: 'pause' }
  | { type: 'timeupdate' }
  | { type: 'seeking' }
  | { type: 'seeked' }
  | { type: 'waiting' }
  | { type: 'ended' }
  | { type: 'error'; error: unknown }
  | { type: 'source_changed'; source: SourceOptions | null }
  | { type: 'dispose' };

export interface PlayerAdapterCallbacks {
  onSignal: (signal: AdapterSignal) => void;
}

export function createPlayerAdapter(
  player: Player,
  cleanup: CleanupRegistry,
  getCurrentSource: () => SourceOptions | null,
  callbacks: PlayerAdapterCallbacks
): void {
  const { onSignal } = callbacks;

  // Player ready - fire after initial setup; we use 'ready' which fires when player is initialized
  cleanup.registerVideoJsListener(player, 'ready', () => {
    onSignal({ type: 'player_ready' });
  });

  // Load start - new source loading
  cleanup.registerVideoJsListener(player, 'loadstart', () => {
    onSignal({ type: 'load_start', source: getCurrentSource() });
  });

  // Play - attempt to play
  cleanup.registerVideoJsListener(player, 'play', () => {
    onSignal({ type: 'play' });
  });

  // Playing - first frame / playback progressing
  cleanup.registerVideoJsListener(player, 'playing', () => {
    onSignal({ type: 'playing' });
  });

  cleanup.registerVideoJsListener(player, 'pause', () => {
    onSignal({ type: 'pause' });
  });

  cleanup.registerVideoJsListener(player, 'timeupdate', () => {
    onSignal({ type: 'timeupdate' });
  });

  cleanup.registerVideoJsListener(player, 'seeking', () => {
    onSignal({ type: 'seeking' });
  });

  cleanup.registerVideoJsListener(player, 'seeked', () => {
    onSignal({ type: 'seeked' });
  });

  // Waiting - buffering/stall (Video.js fires this when playback stalls)
  cleanup.registerVideoJsListener(player, 'waiting', () => {
    onSignal({ type: 'waiting' });
  });

  cleanup.registerVideoJsListener(player, 'ended', () => {
    onSignal({ type: 'ended' });
  });

  cleanup.registerVideoJsListener(player, 'error', () => {
    const err = player.error();
    onSignal({ type: 'error', error: err });
  });

  // Source change - when playlist or src changes externally
  // loadstart already covers source changes; beforeplaylistitem fires before loadstart for playlist items
  const playerAny = player as any;
  if (typeof playerAny.on === 'function') {
    const sourceChangedHandler = () => {
      onSignal({ type: 'source_changed', source: getCurrentSource() });
    };
    playerAny.on('beforeplaylistitem', sourceChangedHandler);
    cleanup.register(() => {
      playerAny.off?.('beforeplaylistitem', sourceChangedHandler);
    });
  }

  // Dispose - when player is disposed
  cleanup.registerVideoJsListener(player, 'dispose', () => {
    onSignal({ type: 'dispose' });
  });
}
