import type { CleanupRegistry } from '../../utils';
import type Player from 'video.js/dist/types/player';

/**
 * Creates and manages the seek feedback UI element that shows visual feedback
 * when the user seeks forward or backward using keyboard shortcuts.
 */
export class SeekFeedback {
  private element: HTMLElement;
  private currentTimeout: ReturnType<typeof setTimeout> | undefined;
  private cleanup: CleanupRegistry;

  constructor(player: Player, cleanup: CleanupRegistry) {
    this.cleanup = cleanup;
    this.element = cleanup.registerElement(document.createElement('div'));
    this.element.className = 'vjs-seek-feedback';
    player.el().appendChild(this.element);
  }

  /**
   * Shows the feedback icon with the specified direction and hides it after a delay.
   * @param direction - The direction of the seek ('forward' or 'backward')
   */
  show(direction: 'forward' | 'backward'): void {
    if (this.currentTimeout) {
      clearTimeout(this.currentTimeout);
    }

    this.element.classList.remove('is-forward', 'is-backward');

    if (direction === 'forward') {
      this.element.classList.add('is-forward');
    } else {
      this.element.classList.add('is-backward');
    }

    this.element.classList.add('is-visible');

    this.currentTimeout = this.cleanup.registerTimeout(() => {
      this.element.classList.remove('is-visible');
      this.currentTimeout = undefined;
    }, 600);
  }
}
