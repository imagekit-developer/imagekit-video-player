import videojs from 'video.js';
const MenuItem = videojs.getComponent('MenuItem');
const Component = videojs.getComponent('Component');

class SourceMenuItem extends MenuItem
{
  constructor(player, options) {
    options.selectable = true;
    options.multiSelectable = false;

    super(player, options);
  }

  handleClick() {
    var selected = this.options_;
    // console.log("Changing quality to:", selected.label);
    // @ts-ignore
    super.handleClick();

    // @ts-ignore
    var levels = this.player().qualityLevels();
    for(var i = 0; i < levels.length; i++) {
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
    // @ts-ignore
    var selectedIndex = this.player().qualityLevels().selectedIndex;
    // @ts-ignore
    this.selected(this.options_.index == selectedIndex);
  }
}

// @ts-ignore
Component.registerComponent('SourceMenuItem', SourceMenuItem);
export default SourceMenuItem;