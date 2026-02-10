import type Player from 'video.js/dist/types/player';
import type { IKPlayerOptions } from '../../interfaces';

/**
 * Initializes the logo button in the control bar based on the player options.
 * If showLogo is enabled, adds or updates the logo button.
 * If disabled, removes any existing logo button.
 * 
 * @param player - The Video.js player instance
 * @param options - ImageKit player options containing logo configuration
 */
export function initializeLogoButton(player: Player, options: IKPlayerOptions): void {
  const controlBar = player.getChild('ControlBar');
  if (!controlBar) {
    return;
  }

  const existingLogoButton = controlBar.getChild('LogoButton');

  if (options.logo?.showLogo) {
    if (existingLogoButton) {
      existingLogoButton.dispose();
    }
    controlBar.addChild('LogoButton', {
      playerOptions: options
    });
  } else {
    if (existingLogoButton) {
      existingLogoButton.dispose();
    }
  }
}
