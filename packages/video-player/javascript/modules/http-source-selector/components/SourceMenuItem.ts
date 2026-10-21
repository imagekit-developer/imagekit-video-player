import videojs from 'video.js';
import type Player from 'video.js/dist/types/player';
import type MenuItemType from 'video.js/dist/types/menu/menu-item';

const MenuItem = videojs.getComponent('MenuItem') as typeof MenuItemType;

interface QualityLevel {
  id: string;
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

const BOUNDARY_OVERLAP = 0.1;

// Latest switch per player, so a slower earlier click can't switch after a newer one.
const latestSwitch = new WeakMap<Player, object>();

/**
 * Where to cut the buffer for a manual switch: the end of the buffered segment at
 * the playhead, or of a later one when that leaves too little time to fetch the
 * new rendition's next segment. Uses VHS's segment-metadata cues, one per
 * appended segment.
 */
function switchBoundary(player: Player, vhs: any, target: any): number {
  const currentTime = player.currentTime() as number;
  const tracks = player.textTracks() as unknown as ArrayLike<TextTrack>;
  let cues: TextTrackCue[] = [];
  for (let i = 0; i < tracks.length; i++) {
    if (tracks[i].label === 'segment-metadata' && tracks[i].cues) {
      cues = Array.from(tracks[i].cues as ArrayLike<TextTrackCue>).sort((a, b) => a.startTime - b.startTime);
    }
  }

  let i = cues.findIndex((cue) => cue.startTime <= currentTime && currentTime < cue.endTime);
  if (i === -1) {
    return currentTime;
  }

  const segmentDuration = cues[i].endTime - cues[i].startTime;
  const bandwidth = target.attributes?.BANDWIDTH;
  const fetchTime = bandwidth && vhs.systemBandwidth ? (bandwidth * segmentDuration) / vhs.systemBandwidth : 0;
  const minLead = fetchTime + 1;

  while (cues[i].endTime - currentTime < minLead && cues[i + 1] && cues[i + 1].startTime - cues[i].endTime < 0.1) {
    i++;
  }
  return cues[i].endTime;
}

/**
 * Switches to `target` from the next segment boundary, like hls.js's `nextLevel`:
 * keeps the buffered segment at the playhead (so playback never runs dry), drops
 * everything after it, and lets VHS refill from there with the new rendition.
 *
 * VHS has no public API for this. Its own manual switch (fastQualityChange_) drops
 * the whole buffer and freezes playback until the new rendition arrives; plain
 * switchMedia_ keeps loading after the existing buffer, so the change only shows
 * once up to a minute of it has played out. The private members used here
 * (playlistController_, mainSegmentLoader_, switchMedia_) are why video.js is
 * pinned to an exact version in package.json.
 */
function switchAtNextSegment(player: Player, target: any) {
  const vhs = (player.tech(true) as any)?.vhs;
  const playlistController = vhs?.playlistController_;
  const loader = playlistController?.mainSegmentLoader_;
  if (!playlistController || !loader || !target || playlistController.media() === target) {
    return;
  }

  const token = {};
  latestSwitch.set(player, token);

  const switchMedia = () => {
    if (latestSwitch.get(player) !== token) {
      return;
    }
    // VHS marks segments appended by position, across renditions, and skips to the
    // one after an appended segment. The kept overlap puts the buffer end inside
    // the boundary segment, so clear the marks or it would be skipped.
    loader.mediaSequenceSync_?.resetAppendedStatus();
    playlistController.switchMedia_(target, 'manual');
  };

  const boundary = switchBoundary(player, vhs, target);
  const duration = player.duration() as number;
  loader.pause();
  loader.abort();
  if (!(boundary < duration) || !loader.getMediaInfo_()) {
    switchMedia();
    return;
  }
  // Renditions' first frames don't line up exactly at a boundary (DASH ones can
  // start ~30ms late), so cutting right at it leaves a gap the playhead stalls on.
  // Keep a little past it; the new segment's append overwrites the overlap.
  loader.remove(boundary + BOUNDARY_OVERLAP, Infinity, switchMedia);
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

    const player = this.player();
    const levels = (player as unknown as PlayerWithQualityLevels).qualityLevels();
    const isAuto = selected.index == levels.length;

    // The menu can outlive its levels for a moment after a source change.
    if (!isAuto && !levels[selected.index]) {
      return;
    }

    const vhs = (player.tech(true) as any)?.vhs;
    const playlists: any[] | undefined = vhs?.playlists?.main?.playlists;
    if (!playlists) {
      for (let i = 0; i < levels.length; i++) {
        levels[i].enabled = isAuto || i == selected.index;
      }
      return;
    }

    // Set the playlists' disabled flags directly rather than through
    // `level.enabled`: the setter starts VHS's whole-buffer flush. The flags
    // still drive VHS's adaptive selection and what `level.enabled` reports.
    const pickedId = isAuto ? null : levels[selected.index].id;
    playlists.forEach((playlist) => {
      if (isAuto || playlist.id === pickedId) {
        delete playlist.disabled;
      } else {
        playlist.disabled = true;
      }
    });

    const target = isAuto ? vhs.playlistController_?.selectPlaylist() : playlists.find((p) => p.id === pickedId);
    switchAtNextSegment(player, target);
  }
}

videojs.registerComponent('SourceMenuItem', SourceMenuItem as any);
export default SourceMenuItem;
