import videojs from 'video.js';
import type Player from 'video.js/dist/types/player';
import type { IKPlayerOptions } from '../../interfaces';

interface LogoButtonOptions {
  playerOptions?: IKPlayerOptions;
  children?: any[];
  className?: string;
}

const ClickableComponent = videojs.getComponent('ClickableComponent');

class LogoButton extends ClickableComponent {
  constructor(player: Player, options?: LogoButtonOptions) {
    super(player, options);
  }

  createEl() {
    const opts = (this.options_ as LogoButtonOptions).playerOptions;
    
    if (!opts || !opts.logo) {
      return videojs.dom.createEl('div', {}, {
        class: 'vjs-control vjs-logo-button',
        style: 'display: none;'
      });
    }

    const { showLogo, logoImageUrl, logoOnclickUrl } = opts.logo;
    const display = showLogo ? 'block' : 'none';
    const bgImage = logoImageUrl ? `background-image: url(${logoImageUrl})` : '';

    return videojs.dom.createEl('a', {}, {
      class: 'vjs-control vjs-logo-button',
      href: logoOnclickUrl || '#',
      target: '_blank',
      rel: 'noopener noreferrer',
      style: `display: ${display}; ${bgImage}`,
      'aria-label': 'Logo link'
    });
  }
}

videojs.registerComponent('LogoButton', LogoButton);

export default LogoButton;
