import videojs from 'video.js';
import type Player from 'video.js/dist/types/player';
import type MenuButtonType from 'video.js/dist/types/menu/menu-button';
import SourceMenuItem from './SourceMenuItem';
import { CleanupRegistry } from '../../../utils';

const MenuButton = videojs.getComponent('MenuButton') as unknown as typeof MenuButtonType;

interface QualityLevel {
  enabled: boolean;
  height?: string;
  bitrate?: number;
}

interface QualityLevelList {
  length: number;
  selectedIndex: number;
  forEach(callback: (level: QualityLevel, index: number) => void): void;
  on(event: string, handler: () => void): void;
  off(event: string, handler: () => void): void;
  [index: number]: QualityLevel;
}

interface PlayerWithQualityLevels {
  qualityLevels(): QualityLevelList;
}

class SourceMenuButton extends MenuButton {
  private cleanup_ = new CleanupRegistry();

  constructor(player: Player, options: any) {
    super(player, options);

    const playerWithQualityLevels = this.player() as unknown as PlayerWithQualityLevels;
    const qualityLevels = playerWithQualityLevels.qualityLevels();

    // Handle options: default bias
    if (options && options.default) {
      if (options.default === 'low') {
        qualityLevels.forEach((level, i) => {
          level.enabled = (i === 0);
        });
      } else if (options.default === 'high') {
        qualityLevels.forEach((level, i) => {
          level.enabled = (i === qualityLevels.length - 1);
        });
      }
    }

    // Rebuild the menu when renditions are added. No need to rebuild on 'change'
    // (playing rendition switched) since the checkmark follows the user's choice.
    // Use native bind instead of deprecated videojs.bind
    const updateHandler = this.update.bind(this);
    this.cleanup_.registerVideoJsListener(qualityLevels, 'addqualitylevel', updateHandler);
  }

  createEl(): HTMLElement {
    return videojs.dom.createEl('div', {
      className: 'vjs-http-source-selector vjs-menu-button vjs-menu-button-popup vjs-control vjs-button'
    }) as HTMLElement;
  }

  buildCSSClass(): string {
    return super.buildCSSClass() + ' vjs-icon-cog';
  }

  update(): void {
    super.update();
  }

  createItems(): SourceMenuItem[] {
    const menuItems: SourceMenuItem[] = [];
    const playerWithQualityLevels = this.player() as unknown as PlayerWithQualityLevels;
    const levels = playerWithQualityLevels.qualityLevels();
    const labels: string[] = [];

    // Check the user's choice rather than levels.selectedIndex, which tracks the
    // rendition currently playing and lags behind a manual pick (and moves around
    // in Auto). Exactly one enabled level means a manual pick; otherwise it's Auto.
    let enabledCount = 0;
    let enabledIndex = -1;
    for (let i = 0; i < levels.length; i++) {
      if (levels[i].enabled) {
        enabledCount++;
        enabledIndex = i;
      }
    }
    const manualIndex = enabledCount === 1 ? enabledIndex : -1;

    for (let i = 0; i < levels.length; i++) {
      const index = levels.length - (i + 1);
      const selected = (index === manualIndex);

      // Display height or bitrate
      let label = `${index}`;
      let sortVal = index;
      if (levels[index].height) {
        label = `${levels[index].height}p`;
        sortVal = parseInt(levels[index].height, 10);
      } else if (levels[index].bitrate) {
        label = `${Math.floor(levels[index].bitrate / 1e3)} kbps`;
        sortVal = parseInt(String(levels[index].bitrate), 10);
      }

      if (labels.includes(label)) {
        continue;
      }
      labels.push(label);

      menuItems.push(new SourceMenuItem(this.player_, { label, index, selected, sortVal }));
    }

    if (levels.length > 1) {
      menuItems.push(new SourceMenuItem(this.player_, {
        label: 'Auto',
        index: levels.length,
        selected: manualIndex === -1,
        sortVal: 99999
      }));
    }

    // Sort menu items descending by sortVal (Auto at top due to 99999)
    menuItems.sort((a, b) => b.options_.sortVal - a.options_.sortVal);

    return menuItems;
  }

  dispose(): void {
    this.cleanup_.dispose();
    super.dispose();
  }
}

// Register component with Video.js
videojs.registerComponent('SourceMenuButton', SourceMenuButton as any);

export default SourceMenuButton;