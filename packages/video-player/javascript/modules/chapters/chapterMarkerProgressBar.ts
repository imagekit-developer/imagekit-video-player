import videojs from 'video.js';
import type Player from 'video.js/dist/types/player';
import { CleanupRegistry } from '../../utils';

const Component = videojs.getComponent('Component');

export interface ChapterMarker {
  startTime: number;
  endTime: number;
  label: string;
}

interface ChapterMarkersProgressBarControlOptions {
  chapters: ChapterMarker[];
  children?: any[];
  className?: string;
}

/**
  * The class for chapter markers
  */
class ChapterMarkersProgressBarControl extends Component {
  private chapterTooltipContainer: HTMLElement | null = null;
  private chapters: ChapterMarker[] = [];
  private cleanup_ = new CleanupRegistry();

  constructor(player: Player, options: ChapterMarkersProgressBarControlOptions) {
    super(player, options);
    this.chapters = options.chapters || [];

    player.ready(() => {
      this.addMarkers(this.chapters, player);
      this.attachHoverHandlers(player);
    });
  }

  /**
   * Creates the visual elements for chapter markers and a single tooltip container.
   */
  addMarkers(chapters: ChapterMarker[], player: Player) {
    const duration = player.duration();
    if (!duration || duration <= 0) return;

    const playheadWell = player.el().querySelector('.vjs-progress-holder');
    if (!playheadWell) return;
    
    // Clear any previous markers
    this.dispose(); 

    // Create a single container for the chapter tooltip
    this.chapterTooltipContainer = document.createElement('div');
    this.chapterTooltipContainer.className = 'vjs-chapter-tooltip-container'; // New class for styling
    playheadWell.appendChild(this.chapterTooltipContainer);

    chapters.forEach((chapter, idx) => {
      if (chapter.startTime < 0 || chapter.endTime > duration || chapter.endTime <= chapter.startTime) {
        return;
      }
      
      const leftPct = (chapter.startTime / duration) * 100;

      // Only add boundary markers
      if (idx > 0) {
        const boundary = document.createElement('div');
        boundary.className = 'vjs-chapter-boundary';
        boundary.style.left = leftPct + '%';
        playheadWell.appendChild(boundary);
      }
    });
  }

  /**
   * Attaches mouse move and leave handlers to the main progress control.
   */
  attachHoverHandlers(player: Player) {
    // Access controlBar.progressControl via type assertion (Video.js internal API)
    const playerWithControlBar = player as unknown as {
      controlBar: {
        progressControl: {
          el(): HTMLElement;
        };
      };
    };
    const progressControl = playerWithControlBar.controlBar.progressControl;
    
    const mousemoveHandler = (e: MouseEvent) => {
      if (!this.chapterTooltipContainer) return;

      const barRect = progressControl.el().getBoundingClientRect();
      const pct = (e.clientX - barRect.left) / barRect.width;
      const time = pct * player.duration();

      // Find the chapter for the current hover time
      const chapter = this.chapters.find(c => time >= c.startTime && time < c.endTime);

      if (chapter) {
        // Update and show the tooltip
        this.chapterTooltipContainer.innerText = chapter.label;
        this.chapterTooltipContainer.style.left = `${pct * 100}%`;
        this.chapterTooltipContainer.style.display = 'block';
      } else {
        // Hide if not over a chapter
        this.chapterTooltipContainer.style.display = 'none';
      }
    };

    const mouseleaveHandler = () => {
      // Hide the tooltip when leaving the progress bar
      if (this.chapterTooltipContainer) {
        this.chapterTooltipContainer.style.display = 'none';
      }
    };

    this.cleanup_.registerVideoJsListener(progressControl, 'mousemove', mousemoveHandler);
    this.cleanup_.registerVideoJsListener(progressControl, 'mouseleave', mouseleaveHandler);
  }

  /**
   * On dispose, remove all created elements.
   */
  dispose() {
    const playheadWell = this.player().el().querySelector('.vjs-progress-holder');
    if (playheadWell) {
      playheadWell.querySelectorAll('.vjs-chapter-boundary').forEach((el) => el.remove());
      if (this.chapterTooltipContainer) {
        this.cleanup_.registerElement(this.chapterTooltipContainer);
      }
    }
    this.cleanup_.dispose();
    super.dispose();
  }
}

videojs.registerComponent('ChapterMarkersProgressBarControl', ChapterMarkersProgressBarControl);

export default ChapterMarkersProgressBarControl;

/**
 * Parses a WebVTT string into an array of chapter marker objects.
 *
 * @param vttData - Raw VTT file string content
 * @returns An array of { time, label } objects
 */

/**
 * Parses a WebVTT string into an array of chapter objects,
 * each of which contains startTime, endTime, and label.
 */
export function parseChaptersFromVTT(vttData: string): ChapterMarker[] {
  const chapters: ChapterMarker[] = []

  // 1) Normalize newlines and split into cue blocks
  const rawBlocks = vttData.replace(/\r\n|\r|\n/g, '\n').split(/\n{2,}/)

  for (const block of rawBlocks) {
    const lines = block.trim().split('\n')
    // A valid cue block has a line containing "-->"
    const timeLine = lines.find((l) => /-->/.test(l))
    if (!timeLine) continue

    // 2) Extract start and end timestamps (like "00:00:05.000 --> 00:00:12.000")
    const [startRaw, endRaw] = timeLine.split('-->').map((s) => s.trim())
    const startTime = timestampToSeconds(startRaw)
    const endTime = timestampToSeconds(endRaw)

    // 3) The next line(s) after the timeLine are the chapter label
    //    (If you had multiple lines of text, you could join them.)
    const labelLine = lines[1] || ''
    const label = labelLine.trim()

    // Only add if label is non-empty and times are valid
    if (
      label &&
      !isNaN(startTime) &&
      !isNaN(endTime) &&
      endTime > startTime
    ) {
      chapters.push({ startTime, endTime, label })
    }
  }

  return chapters
}
  
/** Convert "HH:MM:SS.mmm" → seconds */
function timestampToSeconds(timestamp: string): number {
  // e.g. "00:00:05.000"
  const [hh, mm, ssMs] = timestamp.split(':')
  if (!hh || !mm || !ssMs) return NaN

  const [ss, ms] = ssMs.split('.')
  const hours = parseInt(hh, 10)
  const minutes = parseInt(mm, 10)
  const seconds = parseInt(ss, 10)
  const millis = parseInt(ms || '0', 10)
  return hours * 3600 + minutes * 60 + seconds + millis / 1000
}