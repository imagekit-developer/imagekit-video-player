import videojs from 'video.js';
import type Player from 'video.js/dist/types/player';
import { SourceOptions } from '../../interfaces';

const Component = videojs.getComponent('Component');

interface RecommendationsOverlayOptions {
  recommendations: SourceOptions[];
  children?: any[];
  className?: string;
}

export class RecommendationsOverlay extends Component {
  private recommendations: SourceOptions[];
  private overlayEl!: HTMLDivElement;
  private primaryEl!: HTMLDivElement;
  private listEl!: HTMLDivElement;
  private closeBtn!: HTMLButtonElement;

  constructor(player: Player, options: RecommendationsOverlayOptions) {
    super(player, options);
    this.recommendations = options.recommendations || [];

    this.hide(); // start hidden

    // Build elements
    this.overlayEl = this.createEl('div', { className: 'vjs-recommendations-overlay' }) as HTMLDivElement;
    this.primaryEl = this.createEl('div', { className: 'vjs-rec-primary' }) as HTMLDivElement;
    this.listEl    = this.createEl('div', { className: 'vjs-rec-list' })    as HTMLDivElement;
    this.closeBtn  = this.createEl('button', { className: 'vjs-rec-close' }) as HTMLButtonElement;
    this.closeBtn.innerHTML = '&#10005;'; // ×

    // Assemble
    this.overlayEl.appendChild(this.closeBtn);
    this.overlayEl.appendChild(this.primaryEl);
    this.overlayEl.appendChild(this.listEl);
    this.el().appendChild(this.overlayEl);

    // Listeners
    player.on('ended', this.onEnded);
    this.closeBtn.addEventListener('click', () => this.hide());
  }

  private onEnded = () => {
    this.renderRecommendations();
    this.show();
  };

  private renderRecommendations() {
    const [first, ...rest] = this.recommendations;

    // — Primary card —
    this.primaryEl.innerHTML = '';
    if (first) {
      const thumb = this.createEl('div', { className: 'vjs-rec-thumb' }) as HTMLDivElement;
      thumb.style.backgroundImage = `url('${first.poster?.src || ''}')`;

      const info = this.createEl('div', { className: 'vjs-rec-info' }) as HTMLDivElement;
      info.innerHTML = `
        <h3>${first.info?.title || ''}</h3>
        <p>${first.info?.subtitle || ''}</p>
      `;

      this.primaryEl.appendChild(thumb);
      this.primaryEl.appendChild(info);

      // click to select
      this.primaryEl.onclick = () => this.onClickHandler(first);
    }

    // — Smaller cards —
    this.listEl.innerHTML = '';
    rest.forEach(rec => {
      const card = this.createEl('div', { className: 'vjs-rec-item' }) as HTMLDivElement;
      const thumb = this.createEl('div', { className: 'vjs-rec-thumb' }) as HTMLDivElement;
      thumb.style.backgroundImage = `url('${rec.poster?.src || ''}')`;

      const label = this.createEl('div', { className: 'vjs-rec-label' }) as HTMLDivElement;
      label.textContent = rec.info?.title || '';

      card.appendChild(thumb);
      card.appendChild(label);

      card.onclick = () => this.onClickHandler(rec);
      this.listEl.appendChild(card);
    });
  }

  private onClickHandler(source: SourceOptions) {
    // swap source & play
    this.player().src(source);
    this.hide();
  }
}

// register component
videojs.registerComponent('RecommendationsOverlay', RecommendationsOverlay);
export default RecommendationsOverlay;