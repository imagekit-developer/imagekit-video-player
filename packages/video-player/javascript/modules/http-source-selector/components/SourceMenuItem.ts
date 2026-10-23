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
  [index: number]: QualityLevel;
}

interface PlayerWithQualityLevels {
  qualityLevels(): QualityLevelList;
}

// Renditions' first frames don't line up exactly at a segment boundary (DASH ones can
// start ~30ms late), so cutting right at it leaves a gap the playhead stalls on. Cut a
// little past it; the new rendition's segment overwrites the overlap.
const BOUNDARY_OVERLAP = 0.1;

// Switch in progress per player, so a newer click replaces or cancels it. `cut` once its
// buffer remove has started.
const pendingSwitch = new WeakMap<Player, { cut: boolean }>();

/**
 * Where to start removing buffer for a switch to `target`, as hls.js does for
 * `nextLevel`: after the buffered segment that will be playing once the new
 * rendition's first segment can arrive. Reads VHS's segment-metadata cues, one per
 * appended segment.
 */
function cutStart(player: Player, vhs: any, target: any): number | null {
  const tracks = Array.from(player.textTracks() as unknown as ArrayLike<TextTrack>);
  const track = tracks.find((t) => t.label === 'segment-metadata');
  const cues = Array.from((track?.cues ?? []) as ArrayLike<TextTrackCue>).sort((a, b) => a.startTime - b.startTime);

  const currentTime = player.currentTime() as number;
  const playing = cues.find((cue) => cue.startTime <= currentTime && currentTime < cue.endTime);
  if (!playing) {
    return null;
  }

  const bandwidth = target.attributes?.BANDWIDTH;
  const segmentDuration = playing.endTime - playing.startTime;
  const fetchTime = bandwidth && vhs.systemBandwidth ? (bandwidth * segmentDuration) / vhs.systemBandwidth : 0;
  const reach = currentTime + fetchTime + 1;

  const cut = cues.find((cue) => reach < cue.endTime);
  return cut ? cut.endTime + BOUNDARY_OVERLAP : null;
}

/**
 * Switches to `target` from the next segment boundary, like hls.js's `nextLevel`:
 * keeps the buffered segments playback will reach before the new rendition can
 * arrive, drops everything after them, and lets VHS refill from there.
 *
 * VHS has no public API for this. Its own manual switch (fastQualityChange_) drops
 * the whole buffer and freezes playback until the new rendition arrives; plain
 * switchMedia_ keeps loading after the existing buffer, so the change only shows
 * once up to a minute of it has played out. The private members used here are why
 * video.js is pinned to an exact version in package.json.
 */
function switchAtNextSegment(player: Player, target: any) {
  const vhs = (player.tech(true) as any)?.vhs;
  const playlistController = vhs?.playlistController_;
  const loader = playlistController?.mainSegmentLoader_;
  if (!playlistController || !loader || !target) {
    return;
  }

  // An earlier click's remove may still be pending, or VHS may still be fetching the
  // playlist it switched to (until then media() reports the old rendition).
  const switchInFlight =
    pendingSwitch.has(player) || playlistController.mainPlaylistLoader_?.state === 'SWITCHING_MEDIA';
  if (playlistController.media() === target && !switchInFlight) {
    return;
  }

  const token = { cut: pendingSwitch.get(player)?.cut ?? false };
  pendingSwitch.set(player, token);

  const switchMedia = () => {
    if (pendingSwitch.get(player) !== token) {
      return;
    }
    pendingSwitch.delete(player);
    // VHS marks segments appended by position, across renditions, and skips to the
    // one after an appended segment. A cut's overlap puts the buffer end inside the
    // boundary segment, so clear the marks or it would be skipped. Without a cut, leave
    // them: clearing them makes VHS refetch the last segment, which Firefox can append
    // at the wrong time.
    if (token.cut) {
      loader.mediaSequenceSync_?.resetAppendedStatus();
    }
    const sameMedia = playlistController.media() === target;
    playlistController.switchMedia_(target, 'manual');
    // Switching to the media already playing fires no mediachange, so resync and
    // restart the loader the way a rendition change does, or it resumes past the cut.
    if (sameMedia) {
      loader.resyncLoader();
      loader.load();
    }
  };

  // Cut only before the end of the playlist's last segment, so VHS refetches up to it and
  // ends the stream again. Past it there is nothing to refetch, and the remove would reopen
  // an ended MediaSource that VHS never ends again.
  const start = cutStart(player, vhs, target);
  const segments: any[] = playlistController.media()?.segments ?? [];
  const playlistEnd = segments.reduce((end, segment) => end + segment.duration, 0);
  if (start === null || !(start < playlistEnd) || !loader.getMediaInfo_()) {
    switchMedia();
    return;
  }
  token.cut = true;
  loader.pause();
  loader.abort();
  loader.remove(start, Infinity, switchMedia);
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
