import videojs from 'video.js';
import type Player from 'video.js/dist/types/player';

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
  /**
   * Constructor for class
   *
   * @param {Player|Object} player The player
   * @param {options|Object} options player options
   */
  constructor(player: Player, options: ChapterMarkersProgressBarControlOptions) {
    
    super(player, options);

    if (options.chapters === undefined) {
      options.chapters = [];
    }

    player.ready(() => {
      ChapterMarkersProgressBarControl.addMarkers(options.chapters, player);
    });
  }

  /**
   * addMarkers
   *
   * @param {chapters|Object} chapters chapters array
   * @param {videoDuration|int} videoDuration video duration
   */
  // static addMarkers(chapters: ChapterMarker[], player: Player) {
  //   const videoDuration = player.duration();
  //   if (!videoDuration || videoDuration === 0) {
  //     return;
  //   }
  //   const iMax = chapters.length;
  //   var playerContainer = player.el();
  //   const playheadWell = playerContainer.getElementsByClassName('vjs-progress-holder')[0];

  //   // Loop over each cue point, dynamically create a div for each
  //   // then place in div progress bar
  //   for (let i = 0; i < iMax; i++) {

  //     if(chapters[i].time < 0 || chapters[i].time > videoDuration)
  //     {
  //       continue;
  //     }

  //     const elem = document.createElement('div');

  //     elem.className = 'vjs-viostream-marker';
  //     elem.id = 'cp' + i;

  //     const percentage = (chapters[i].time / videoDuration) * 100;
  //     elem.style.left = percentage + '%';

  //     const spanToolTip = document.createElement('span');

  //     spanToolTip.className = 'tooltiptext';
  //     spanToolTip.innerHTML = chapters[i].label;
  //     elem.appendChild(spanToolTip);

  //     playheadWell.appendChild(elem);
  //   }
  // }

 /**
   * For each chapter:
   *  1) Create a transparent segment div (.vjs-chapter-segment) spanning [startTime,endTime].
   *  2) Inside it, create a hidden tooltip div that will follow the mouse.
   *  3) Also, create a vertical boundary line (.vjs-chapter-boundary) at startTime (except the first chapter).
   */
 static addMarkers(chapters: ChapterMarker[], player: Player) {
  const duration = player.duration();
  if (!duration || duration <= 0) return;

  const playheadWell = player.el().getElementsByClassName('vjs-progress-holder')[0];
  if (!playheadWell) return;

  chapters.forEach((chapter, idx) => {
    // 1) Validate times
    if (
      chapter.startTime < 0 ||
      chapter.endTime > duration ||
      chapter.endTime <= chapter.startTime
    ) {
      return;
    }

    // 2) Compute left% and width% for this chapter
    const leftPct = (chapter.startTime / duration) * 100;
    const widthPct = ((chapter.endTime - chapter.startTime) / duration) * 100;

    // 3) Create the “segment” div
    const segment = document.createElement('div');
    segment.className = 'vjs-chapter-segment';
    segment.style.left = leftPct + '%';
    segment.style.width = widthPct + '%';

    // 4) Create a tooltip div inside the segment (hidden by default)
    const tooltip = document.createElement('div');
    tooltip.className = 'vjs-chapter-segment-tooltip';
    tooltip.innerText = chapter.label;
    segment.appendChild(tooltip);

    // 5) Attach mouse events so the tooltip follows the cursor
    segment.addEventListener('mousemove', (e: MouseEvent) => {
      // e.offsetX is x-coordinate within this segment
      const relativeX = e.offsetX;
      // Move tooltip so its center is under the cursor
      tooltip.style.left = relativeX + 'px';
    });
    segment.addEventListener('mouseenter', () => {
      tooltip.style.display = 'block';
    });
    segment.addEventListener('mouseleave', () => {
      tooltip.style.display = 'none';
    });

    // 6) Append the segment into the progress bar
    playheadWell.appendChild(segment);

    // 7) If this is NOT the first chapter, draw a boundary line at startTime
    if (idx > 0) {
      const boundary = document.createElement('div');
      boundary.className = 'vjs-chapter-boundary';
      boundary.style.left = leftPct + '%';
      playheadWell.appendChild(boundary);
    }
  });
}



  /** On dispose(), remove all .vjs-chapter-segment elements */
  dispose() {
    const playheadWell = this.player().el().querySelector('.vjs-progress-holder')
    if (playheadWell) {
      playheadWell.querySelectorAll('.vjs-chapter-segment').forEach((el) => el.remove());
      playheadWell.querySelectorAll('.vjs-chapter-boundary').forEach((el) => el.remove());    }
    super.dispose()
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