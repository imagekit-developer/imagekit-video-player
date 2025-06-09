import videojs from 'video.js';
import SourceMenuItem from './SourceMenuItem';

const MenuButton = videojs.getComponent('MenuButton');

class SourceMenuButton extends MenuButton {
  constructor(player, options) {
    super(player, options);

    const qualityLevels = this.player().qualityLevels();

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

    // Bind update to qualityLevels changes
    this.player().qualityLevels().on(['change', 'addqualitylevel'], videojs.bind(this, this.update));
  }

  createEl() {
    return videojs.dom.createEl('div', {
      className: 'vjs-http-source-selector vjs-menu-button vjs-menu-button-popup vjs-control vjs-button'
    });
  }

  buildCSSClass() {
    return super.buildCSSClass() + ' vjs-icon-cog';
  }

  update() {
    return super.update();
  }

  createItems() {
    const menuItems = [];
    const levels = this.player().qualityLevels();
    const labels = [];

    for (let i = 0; i < levels.length; i++) {
      const index = levels.length - (i + 1);
      const selected = (index === levels.selectedIndex);

      // Display height or bitrate
      let label = `${index}`;
      let sortVal = index;
      if (levels[index].height) {
        label = `${levels[index].height}p`;
        sortVal = parseInt(levels[index].height, 10);
      } else if (levels[index].bitrate) {
        label = `${Math.floor(levels[index].bitrate / 1e3)} kbps`;
        sortVal = parseInt(levels[index].bitrate, 10);
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
        selected: false,
        sortVal: 99999
      }));
    }

    // Sort menu items descending by sortVal (Auto at top due to 99999)
    menuItems.sort((a, b) => b.options_.sortVal - a.options_.sortVal);

    return menuItems;
  }
}

// Register component with Video.js
videojs.registerComponent('SourceMenuButton', SourceMenuButton);

export default SourceMenuButton;