import type { CleanupRegistry } from '../../utils';
import type Player from 'video.js/dist/types/player';
import { SeekFeedback } from './seek-feedback';
import { announce } from '../a11y/announcer';

/**
 * Configuration options for keyboard shortcuts.
 */
export interface KeyboardShortcutsOptions {
  /** Amount of time to skip in seconds when using arrow keys. Default: 10 */
  skipTime?: number;
}

const INTERACTIVE_SELECTOR = [
  'a[href]',
  'button',
  'input',
  'select',
  'textarea',
  '[contenteditable]',
  '[role="button"]',
  '[role="link"]',
  '[role="slider"]',
  '[role^="menuitem"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

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
    // Leave browser and OS shortcuts (Ctrl+F, Cmd+F, Alt+Arrow, ...) untouched.
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    // Keys pressed on our own interactive elements inside the player (shoppable
    // items, hotspots, playlist items, ...) belong to that element, not to the
    // player-wide shortcuts. Video.js controls already stop propagation themselves.
    const target = event.target as HTMLElement | null;
    const interactiveTarget = target?.closest?.(INTERACTIVE_SELECTOR);
    if (interactiveTarget && interactiveTarget !== player.el()) {
      return;
    }

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
        // The visual "+10s" feedback is a status message; say it too (WCAG 4.1.3).
        announce(player, player.localize('Forward {1} seconds', [String(skipTime)]));
        break;

      case 'ArrowLeft':
        event.preventDefault();
        player.currentTime((player.currentTime() ?? 0) - skipTime);
        seekFeedback.show('backward');
        announce(player, player.localize('Back {1} seconds', [String(skipTime)]));
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
