import videojs from 'video.js';
import type Player from 'video.js/dist/types/player';
import type { IKPlayerOptions } from '../../interfaces';

/**
 * Generates the context menu content based on the player's current state.
 * @param player - The video player instance
 * @returns Array of context menu items
 */
function createContextMenuContent(player: Player) {
  return [{
    label: player.paused() ? "Play" : "Pause",
    listener: function () {
      if (player.paused()) {
        player.play();
      } else {
        player.pause();
      }
    }
  },
  {
    label: player.loop() ? "Unloop" : "Loop",
    listener: function () {
      player.loop(!player.loop());
    }
  },
  {
    label: player.muted() ? "Unmute" : "Mute",
    listener: function () {
      player.muted(!player.muted());
    }
  },
  {
    label: player.isFullscreen() ? "Exit Fullscreen" : "Fullscreen",
    listener: function () {
      if (player.isFullscreen()) {
        player.exitFullscreen();
      } else {
        player.requestFullscreen();
      }
    }
  }];
}

/**
 * Sets up the context menu for the video player.
 * If hideContextMenu is true, prevents the default context menu.
 * Otherwise, initializes the context menu plugin with default menu items.
 * 
 * @param player - The Video.js player instance
 * @param options - ImageKit player options
 */
export function setupContextMenu(player: Player, options: IKPlayerOptions): void {
  if (options.hideContextMenu === true) {
    player.on('contextmenu', (e: Event) => {
      e.preventDefault();
    });
    return;
  }

  const hasContextMenuUIMethod = typeof (player as any).contextmenuUI === 'function';

  if (!hasContextMenuUIMethod) {
    player.log.error(`[ImageKit Video Player] contextmenuUI method not found on player. Available plugins: ${Object.keys(videojs.getPlugins()).join(', ')}`);
    return;
  }

  try {
    (player as any).contextmenuUI({
      createContextMenuContent: createContextMenuContent
    });
  } catch (error) {
    player.log.error('[ImageKit Video Player] Failed to initialize context menu plugin:', error);
  }
}
