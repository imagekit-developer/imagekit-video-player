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
  on(event: string, handler: () => void): void;
  off(event: string, handler: () => void): void;
  [index: number]: QualityLevel;
}

interface PlayerWithQualityLevels {
  qualityLevels(): QualityLevelList;
}

// Cancels the pending switch follow-up for a player, so a newer click replaces it.
const pendingSwitch = new WeakMap<Player, () => void>();

/**
 * Makes a manual quality switch show up right away instead of after the
 * already-buffered segments play out. Two VHS behaviours get in the way:
 *
 * 1. Switching to a VOD rendition VHS has already loaded completes
 *    synchronously, before fastQualityChange_ sets the flag that triggers its
 *    buffer flush, so the flush never runs. Run it ourselves when VHS leaves
 *    the flag set after the switch.
 * 2. Even after the buffer is replaced, the browser keeps showing the frames it
 *    already decoded from the old rendition until the next keyframe (up to a
 *    whole segment later). Once the new rendition's segment covering the
 *    playhead is appended, seek to the current position so the decoder
 *    restarts from it.
 */
function finishSwitch(player: Player, levelIndex: number) {
  pendingSwitch.get(player)?.();

  const levels = (player as unknown as PlayerWithQualityLevels).qualityLevels();
  const onLevelChange = () => {
    if (levels.selectedIndex !== levelIndex) {
      return;
    }
    // VHS sets the flag right after the synchronous media change that fired
    // this event, so check on the next tick.
    player.setTimeout(() => {
      const playlistController = (player.tech(true) as any)?.vhs?.playlistController_;
      if (
        playlistController?.waitingForFastQualityPlaylistReceived_ &&
        typeof playlistController.runFastQualitySwitch_ === 'function'
      ) {
        playlistController.runFastQualitySwitch_();
      }
    }, 0);
  };
  const onAppend = (event: any) => {
    const segment = event.metadata?.segmentInfo;
    if (levels.selectedIndex !== levelIndex || !segment || segment.type !== 'main' || segment.isMediaInitialization) {
      return;
    }
    const currentTime = player.currentTime() as number;
    if (currentTime < segment.start || currentTime >= segment.start + segment.duration) {
      return;
    }
    cancel();
    player.currentTime(currentTime);
  };
  const cancel = () => {
    levels.off('change', onLevelChange);
    player.off('appendsdone', onAppend);
    player.clearTimeout(timeout);
    pendingSwitch.delete(player);
  };
  const timeout = player.setTimeout(cancel, 10000);

  levels.on('change', onLevelChange);
  player.on('appendsdone', onAppend);
  pendingSwitch.set(player, cancel);
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

    // MenuItem.handleClick only checks this item; uncheck the others so the
    // menu never shows two selections.
    const menu = (this as any).parentComponent_;
    menu?.children().forEach((item: any) => {
      if (item !== this && typeof item.selected === 'function') {
        item.selected(false);
      }
    });

    const player = this.player() as unknown as PlayerWithQualityLevels;
    const levels = player.qualityLevels();

    if (selected.index == levels.length) {
      // If this is the Auto option, enable all renditions for adaptive selection
      pendingSwitch.get(this.player())?.();
      for (let i = 0; i < levels.length; i++) {
        levels[i].enabled = true;
      }
      return;
    }

    // VHS skips the switch when the picked level is the one already playing.
    if (levels.selectedIndex !== selected.index) {
      finishSwitch(this.player(), selected.index);
    }

    for (let i = 0; i < levels.length; i++) {
      if (i != selected.index) {
        levels[i].enabled = false;
      }
    }

    // VHS only runs its fast quality change (flush the buffer and reload at the
    // new rendition) when a level goes from disabled to enabled. Coming from
    // Auto the picked level is already enabled, so toggle it off and on;
    // otherwise the already-buffered segments play out at the old quality.
    // A seek alone doesn't flush anything: VHS ignores seeks into the buffer.
    const level = levels[selected.index];
    if (level.enabled) {
      level.enabled = false;
    }
    level.enabled = true;
  }
}

videojs.registerComponent('SourceMenuItem', SourceMenuItem as any);
export default SourceMenuItem;