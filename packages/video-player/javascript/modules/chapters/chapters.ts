import type Player from 'video.js/dist/types/player';
import type { SourceOptions, IKPlayerOptions } from '../../interfaces';
import { ChapterMarker, parseChaptersFromVTT } from './chapterMarkerProgressBar';
import { prepareChaptersVttSrc } from '../../utils';

interface ChapterTrackMetadata {
  langCode: string;
  chapterList: ChapterMarker[];
  vttUrl: string;
}

// Map to store chapter tracks by language
const chapterTracksCache = new Map<string, ChapterTrackMetadata>();

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
 * Clean up all chapter-related components from the player.
 * Removes chapter text tracks, label display, and progress bar control.
 */
function cleanupChapters(player: Player): void {
  cleanupChapterTextTracks(player);
  cleanupChapterLabelDisplay(player);
  const existing = player.getChild('ChapterMarkersProgressBarControl');
  if (existing) {
    existing.dispose();
  }
}


/**
 * Load chapters for a specific language
 */
async function loadChaptersForLanguage(
  player: Player,
  vttUrl: string,
  langCode: string = 'en'
): Promise<ChapterMarker[]> {
  // Check cache first
  if (chapterTracksCache.has(langCode)) {
    return chapterTracksCache.get(langCode)!.chapterList;
  }

  try {
    const res = await fetch(vttUrl);
    if (!res.ok) {
      player.log.warn(`Chapter VTT fetch failed for ${langCode} with status: (${res.status})`);
      return [];
    }
    const data = await res.text();
    const chapterList = parseChaptersFromVTT(data);

    // Cache the chapters
    chapterTracksCache.set(langCode, { langCode, chapterList, vttUrl });

    return chapterList;
  } catch (e) {
    player.log.error(`Failed to fetch chapters for ${langCode}: ${e}`);
    return [];
  }
}

/**
 * Switch chapters to match the active subtitle language
 */
async function switchChaptersLanguage(
  player: Player,
  langCode: string
): Promise<void> {
  const metadata = chapterTracksCache.get(langCode);
  
  if (!metadata) {
    player.log.warn(`No chapter track found for language: ${langCode}`);
    return;
  }

  // Clean up existing chapters
  cleanupChapters(player);

  // Apply new chapters
  applyChaptersToPlayer(player, metadata.chapterList);
}

/**
 * Apply chapter list to player (extracted for reuse)
 */
function applyChaptersToPlayer(player: Player, chapterList: ChapterMarker[]): void {
  if (chapterList.length === 0) return;

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

    setupChapterLabelDisplay(player, trackEl.track);

    // Update the chapters button
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
    existing.dispose();
  }
  player.addChild('ChapterMarkersProgressBarControl', { chapters: chapterList });
}

/**
 * Setup listener for subtitle track changes to switch chapters accordingly
 */
function setupSubtitleChapterSync(player: Player): void {
  const textTracks = player.textTracks();
  
  textTracks.addEventListener('change', () => {
    let foundActiveTrack = false;
    
    // Check for active subtitle track
    for (let i = 0; i < textTracks.length; i++) {
      const track = textTracks[i];
      
      // Find the active subtitle track
      if ((track.kind === 'subtitles' || track.kind === 'captions') && track.mode === 'showing') {
        const langCode = track.language || 'en';
        
        // Switch chapters to match this language
        if (chapterTracksCache.has(langCode)) {
          switchChaptersLanguage(player, langCode);
          foundActiveTrack = true;
        }
        break;
      }
    }
    
    // If no subtitle track is active (user turned off captions), revert to base chapters
    if (!foundActiveTrack && chapterTracksCache.has('base')) {
      switchChaptersLanguage(player, 'base');
    }
  });
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
 * 1. Auto-generate: chapters: true (with optional translations)
 * 2. VTT URL: chapters: { url: string }
 * 3. Manual object: chapters: { [timeInSec]: title }
 */
export async function initChapterMarkers(
  player: Player,
  source: SourceOptions | SourceOptions[] | null,
  ikGlobalSettings: IKPlayerOptions
): Promise<void> {

  cleanupChapters(player);

  // Clear cache for new source
  chapterTracksCache.clear();

  if (!source) return;
  
  const src = Array.isArray(source) ? source[0] : source;
  if (!src.chapters) return;

  let chapterList: ChapterMarker[] = [];

  if (typeof src.chapters === 'object' && 'url' in src.chapters) {
    // Manual VTT URL - load directly
    try {
      let vttUrl = src.chapters.url;
      
      if (ikGlobalSettings.signerFn) {
        try {
          vttUrl = await ikGlobalSettings.signerFn(vttUrl);
        } catch (err) {
          player.log.error(`Failed to sign chapter VTT URL: ${err instanceof Error ? err.message : String(err)}`);
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
      player.log.error(`Failed to fetch chapters VTT: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }
  } else if (typeof src.chapters === 'object') {
    // Manual chapter object - convert to ChapterMarker[]
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
    // Auto-generate chapters with translations support
    try {
      const { baseUrl, translatedUrls } = await prepareChaptersVttSrc(src, ikGlobalSettings);
      
      // Load base language chapters
      chapterList = await loadChaptersForLanguage(player, baseUrl, 'base');

      // Pre-load translated chapters in background
      if (translatedUrls.size > 0) {
        for (const [langCode, url] of translatedUrls.entries()) {
          // Load in background without blocking
          loadChaptersForLanguage(player, url, langCode).catch(err => {
            player.log.warn(`Failed to pre-load chapters for ${langCode}:`, err);
          });
        }

        // Setup subtitle-chapter synchronization
        setupSubtitleChapterSync(player);
      }
    } catch (e) {
      player.log.error(`Failed to fetch default chapters VTT: ${e}`);
      return;
    }
  }

  // Apply the base/default chapters
  if (chapterList.length > 0) {
    applyChaptersToPlayer(player, chapterList);
  }
}
