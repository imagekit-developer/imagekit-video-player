import videojs from 'video.js';
import type Player from 'video.js/dist/types/player';
import { PlayerOptions, SourceOptions } from '../../interfaces';
import { preparePosterSrc } from '../../utils';

const Component = videojs.getComponent('Component');

interface RecommendationsOverlayOptions {
  recommendations: SourceOptions[];
  playerOptions: PlayerOptions;
  children?: any[];
  className?: string;
}

export class RecommendationsOverlay extends Component {
  private recommendations: SourceOptions[];
  private playerOptions: PlayerOptions;
  private gridEl!: HTMLDivElement;
  private closeBtn!: HTMLButtonElement;

  constructor(player: Player, options: RecommendationsOverlayOptions) {
    super(player, options);
    this.recommendations = options.recommendations || [];
    this.playerOptions = options.playerOptions;

    this.hide(); // start hidden

    // Build elements using the correct static method
    this.gridEl    = videojs.dom.createEl('div', { className: 'vjs-rec-list' }) as HTMLDivElement;
    this.closeBtn  = videojs.dom.createEl('div', { className: 'vjs-rec-close' }) as HTMLButtonElement;
    this.closeBtn.innerHTML = '&#10005;'; // ×

    // Assemble
    this.el().appendChild(this.closeBtn);
    this.el().appendChild(this.gridEl);

    // Listeners
    player.on('ended', this.onEnded);
    this.closeBtn.addEventListener('click', () => this.hide());
  }

  createEl() {
    return super.createEl('div', { className: 'vjs-recommendations-overlay' });
  }

  private onEnded = () => {
    this.renderRecommendations();
    this.show();
  };

  private renderRecommendations() {
    this.gridEl.innerHTML = '';
    this.recommendations.forEach(rec => {
      const card = this._createRecommendationItem(rec);
      this.gridEl.appendChild(card);
    });
  }

  // Add this new private helper method to the RecommendationsOverlay class

  /**
   * Creates a single recommendation item element, including the logic
   * for asynchronously loading its poster.
   * @param rec - The source options for the recommendation item.
   * @returns A complete HTML element for the card.
   * @private
   */
  private _createRecommendationItem(rec: SourceOptions): HTMLDivElement {
    const card = videojs.dom.createEl('div', { className: 'vjs-rec-item' }) as HTMLDivElement;
    const thumb = videojs.dom.createEl('div', { className: 'vjs-rec-thumb' }) as HTMLDivElement;
    
    // Create and add the title label INSIDE the thumbnail container.
    // This is crucial for the overlay styling to work correctly.
    const label = videojs.dom.createEl('div', { className: 'vjs-rec-title' }) as HTMLDivElement;
    label.textContent = rec.info?.title || '';
    
    // Create and add the spinner.
    const spinner = videojs.dom.createEl('div', { className: 'vjs-rec-thumb-spinner' });
    thumb.appendChild(spinner);

    // Assemble the card structure correctly.
    card.appendChild(thumb);
    thumb.appendChild(label); // Append label to thumb for overlay effect

    // Asynchronously load the poster.
    preparePosterSrc(rec, this.playerOptions)
      .then((url) => {
        // On success, remove spinner and set the background image.
        spinner.remove();
        thumb.style.backgroundImage = `url('${url}')`;
      })
      .catch((err) => {
        // On failure, remove spinner and apply a placeholder style to the thumbnail.
        this.player_.log.error(`Failed to load poster for recommendation item: ${err.message}`);
        spinner.remove();
        // CORRECTED: Apply the placeholder class to the 'thumb' element, not the removed spinner.
        thumb.classList.add('vjs-rec-thumb-placeholder');
      });

    card.onclick = () => this.onClickHandler(rec);
    return card;
  }

  private onClickHandler(source: SourceOptions) {
    this.player().src(source);
    this.hide();
  }
}

// register component
videojs.registerComponent('RecommendationsOverlay', RecommendationsOverlay);
export default RecommendationsOverlay;