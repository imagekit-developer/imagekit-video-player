import type Player from 'video.js/dist/types/player';
import type { SourceOptions, IKPlayerOptions } from '../../interfaces';
import { ChapterMarker, parseChaptersFromVTT } from './chapterMarkerProgressBar';
import { prepareChaptersVttSrc } from '../../utils';

/**
 * Clean up existing chapter text tracks from the player.
 */
function cleanupChapterTextTracks(player: Player): void {
  const playerWithTextTracks = player as unknown as {
    remoteTextTracks(): TextTrackList;
    removeRemoteTextTrack(track: TextTrack): void;
  };
  const textTracks = playerWithTextTracks.remoteTextTracks();

  for (let i = textTracks.length - 1; i >= 0; i--) {
    if (textTracks[i].kind === 'chapters') {
      playerWithTextTracks.removeRemoteTextTrack(textTracks[i]);
    }
  }
}

/**
 * Clean up existing chapter label display from the control bar.
 */
function cleanupChapterLabelDisplay(player: Player): void {
  const playerWithQuery = player as unknown as {
    $(selector: string): HTMLElement | null;
  };
  const spacer = playerWithQuery.$('.vjs-control-bar .vjs-spacer') as HTMLElement | null;
  if (spacer) {
    spacer.classList.remove('vjs-control-bar-chapter-wrapper');
    const display = spacer.querySelector('.vjs-control-bar-chapter-display');
    if (display) {
      display.remove();
    }
  }
}

/**
 * Setup chapter label display in the control bar.
 * Displays the current chapter name and updates on cuechange events.
 */
function setupChapterLabelDisplay(player: Player, chaptersTrack: TextTrack): void {
  const playerWithQuery = player as unknown as {
    $(selector: string): HTMLElement | null;
  };

  const controlBarChapterHolder =
    (playerWithQuery.$('.vjs-control-bar-chapter-display') as HTMLElement) ||
    document.createElement('div');
  controlBarChapterHolder.setAttribute('class', 'vjs-control-bar-chapter-display');

  const spacer = playerWithQuery.$('.vjs-control-bar .vjs-spacer') as HTMLElement | null;
  if (!spacer) {
    player.log.warn('Control bar spacer not found, cannot setup chapter display');
    return;
  }

  spacer.innerHTML = '';
  spacer.classList.add('vjs-control-bar-chapter-wrapper');
  spacer.appendChild(controlBarChapterHolder);

  chaptersTrack.addEventListener('cuechange', () => {
    // Safari needs Array.from() for activeCues
    const activeCues = Array.from(chaptersTrack.activeCues);
    if (activeCues.length > 0) {
      const cue = activeCues[0] as VTTCue;
      controlBarChapterHolder.innerText = cue.text || '';
    } else {
      controlBarChapterHolder.innerText = '';
    }
  });
}

/**
 * Initialize chapter markers for the video player.
 * Supports three methods:
 * 1. Auto-generate: chapters: true
 * 2. VTT URL: chapters: { url: string }
 * 3. Manual object: chapters: { [timeInSec]: title }
 */
export async function initChapterMarkers(
  player: Player,
  source: SourceOptions | SourceOptions[] | null,
  ikGlobalSettings: IKPlayerOptions,
  signerFn?: (src: string) => Promise<string>
): Promise<void> {
  if (!source) return;
  
  const src = Array.isArray(source) ? source[0] : source;
  if (!src.chapters) return;

  let chapterList: ChapterMarker[] = [];

  if (typeof src.chapters === 'object' && 'url' in src.chapters) {
    try {
      let vttUrl = src.chapters.url;
      
      if (signerFn) {
        try {
          vttUrl = await signerFn(vttUrl);
        } catch (err) {
          player.log.warn(`Failed to sign chapter VTT URL: ${err instanceof Error ? err.message : String(err)}`);
          return;
        }
      }
      
      const res = await fetch(vttUrl);
      if (!res.ok) {
        player.log.warn(`VTT fetch failed with status: (${res.status}); skipping chapters.`);
        return;
      }
      const data = await res.text();
      chapterList = parseChaptersFromVTT(data);
    } catch (e) {
      player.log.warn(`Failed to fetch chapters VTT: ${e}`);
      return;
    }
  } else if (typeof src.chapters === 'object') {
    const entries = Object.entries(src.chapters)
      .map(([time, label]) => ({ startTime: Number(time), label: String(label) }))
      .sort((a, b) => a.startTime - b.startTime);

    const duration = player.duration() || 0;

    chapterList = entries.map((entry, index) => {
        const endTime =
        index < entries.length - 1
          ? entries[index + 1].startTime
          : duration || entry.startTime + 10;
      return {
        startTime: entry.startTime,
        endTime: endTime,
        label: entry.label,
      };
    });
  } else if (src.chapters === true) {
    try {
      const chaptersVttSrc = await prepareChaptersVttSrc(src, ikGlobalSettings);
      const res = await fetch(chaptersVttSrc);
      if (!res.ok) {
        player.log.warn(`Default VTT fetch failed with status: (${res.status}); skipping chapters.`);
        return;
      }
      const data = await res.text();
      chapterList = parseChaptersFromVTT(data);
    } catch (e) {
      player.log.warn(`Failed to fetch default chapters VTT: ${e}`);
      return;
    }
  }

  if (chapterList.length) {
    cleanupChapterTextTracks(player);

    try {
      const trackEl = player.addRemoteTextTrack(
        {
          kind: 'chapters',
          default: true,
        },
        false
      ) as unknown as HTMLTrackElement;

      chapterList.forEach((chapter) => {
        const cue = new VTTCue(chapter.startTime, chapter.endTime, chapter.label);
        trackEl.track.addCue(cue);
      });

      cleanupChapterLabelDisplay(player);
      setupChapterLabelDisplay(player, trackEl.track);

      const controlBar = player.getChild('ControlBar');
      if (controlBar) {
        const chaptersButton = controlBar.getChild('ChaptersButton');
        if (chaptersButton && typeof (chaptersButton as any).update === 'function') {
          (chaptersButton as any).update();
        }
      }
    } catch (e) {
      player.log.warn(`Failed to create chapter text track: ${e}`);
    }

    const existing = player.getChild('ChapterMarkersProgressBarControl');
    if (existing) {
      console.log('Disposing existing chapter markers progress bar control');
      existing.dispose();
    }
    player.addChild('ChapterMarkersProgressBarControl', { chapters: chapterList });
  }
}
