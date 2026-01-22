import videojs from 'video.js';
import type Player from 'video.js/dist/types/player';
import type MenuItemType from 'video.js/dist/types/menu/menu-item';

const MenuItem = videojs.getComponent('MenuItem') as typeof MenuItemType;

interface QualityLevel {
  enabled: boolean;
  height?: string;
  bitrate?: number;
}

interface QualityLevelList {
  length: number;
  selectedIndex: number;
  forEach(callback: (level: QualityLevel, index: number) => void): void;
  [index: number]: QualityLevel;
}

interface PlayerWithQualityLevels {
  qualityLevels(): QualityLevelList;
}

class SourceMenuItem extends MenuItem {
  constructor(player: Player, options: any) {
    options.selectable = true;
    options.multiSelectable = false;

    super(player, options);
  }

  handleClick(event: Event) {
    const selected = this.options_;
    // Call parent handleClick
    super.handleClick(event);

    const player = this.player() as unknown as PlayerWithQualityLevels;
    const levels = player.qualityLevels();
    for (let i = 0; i < levels.length; i++) {
      if (selected.index == levels.length) {
        // If this is the Auto option, enable all renditions for adaptive selection
        levels[i].enabled = true;
      } else if (selected.index == i) {
        levels[i].enabled = true;
      } else {
        levels[i].enabled = false;
      }
    }
  }

  update() {
    const player = this.player() as unknown as PlayerWithQualityLevels;
    const qualityLevels = player.qualityLevels();
    const selectedIndex = qualityLevels.selectedIndex;
    this.selected(this.options_.index == selectedIndex);
  }
}

videojs.registerComponent('SourceMenuItem', SourceMenuItem as any);
export default SourceMenuItem;