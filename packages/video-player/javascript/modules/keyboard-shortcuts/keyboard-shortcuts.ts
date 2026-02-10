import type { CleanupRegistry } from '../../utils';
import type Player from 'video.js/dist/types/player';
import { SeekFeedback } from './seek-feedback';

/**
 * Configuration options for keyboard shortcuts.
 */
export interface KeyboardShortcutsOptions {
  /** Amount of time to skip in seconds when using arrow keys. Default: 10 */
  skipTime?: number;
}

/**
 * Sets up keyboard shortcuts for the video player.
 * Supports:
 * - Space: Play/Pause
 * - Arrow Left/Right: Seek backward/forward
 * - F: Toggle fullscreen
 * 
 * @param player - The Video.js player instance
 * @param cleanup - Cleanup registry for managing resources
 * @param options - Optional configuration for keyboard shortcuts
 */
export function setupKeyboardShortcuts(
  player: Player,
  cleanup: CleanupRegistry,
  options: KeyboardShortcutsOptions = {}
): void {
  const skipTime = options.skipTime ?? 10;
  const seekFeedback = new SeekFeedback(player, cleanup);

  const keydownHandler = (event: KeyboardEvent) => {
    switch (event.key) {
      case ' ':
        event.preventDefault();
        if (player.paused()) {
          player.play();
        } else {
          player.pause();
        }
        break;

      case 'ArrowRight':
        event.preventDefault();
        player.currentTime((player.currentTime() ?? 0) + skipTime);
        seekFeedback.show('forward');
        break;

      case 'ArrowLeft':
        event.preventDefault();
        player.currentTime((player.currentTime() ?? 0) - skipTime);
        seekFeedback.show('backward');
        break;

      case 'f':
      case 'F':
        event.preventDefault();
        if (player.isFullscreen()) {
          player.exitFullscreen();
        } else {
          player.requestFullscreen();
        }
        break;
    }
  };

  cleanup.registerVideoJsListener(player, 'keydown', keydownHandler);
}
