import videojs from 'video.js';
import type Player from 'video.js/dist/types/player';
import type { IKPlayerOptions } from '../../interfaces';

interface LogoButtonOptions {
  playerOptions?: IKPlayerOptions;
  children?: any[];
  className?: string;
}

const ClickableComponent = videojs.getComponent('ClickableComponent');

const parseUrl = (value: string | undefined): URL | null => {
  if (!value) return null;
  try {
    return new URL(value, document.baseURI);
  } catch {
    return null;
  }
};

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

    const { showLogo, logoImageUrl, logoOnclickUrl, logoAltText } = opts.logo;
    const imageUrl = parseUrl(logoImageUrl);
    const linkUrl = parseUrl(logoOnclickUrl);
    const isHttpLink = !!linkUrl && (linkUrl.protocol === 'https:' || linkUrl.protocol === 'http:');
    const name = logoAltText || this.localize('Logo');

    const el = videojs.dom.createEl('a', {}, {
      class: 'vjs-control vjs-logo-button',
      href: isHttpLink ? linkUrl.href : '#',
      target: '_blank',
      rel: 'noopener noreferrer',
      'aria-label': this.localize('{1} (opens in a new tab)', [name])
    }) as HTMLAnchorElement;

    // Set through CSSOM with a quoted url(), so the URL can't add other declarations.
    el.style.display = showLogo ? 'block' : 'none';
    if (imageUrl) el.style.backgroundImage = `url(${JSON.stringify(imageUrl.href)})`;
    return el;
  }
}

videojs.registerComponent('LogoButton', LogoButton);

export default LogoButton;
