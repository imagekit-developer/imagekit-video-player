import videojs from 'video.js';
import type Player from 'video.js/dist/types/player';
import type { IKPlayerOptions, SourceOptions } from '../../interfaces';
import { prepareSeekThumbnailVttSrc } from '../../utils';

const log = videojs.log.createLogger('videojs-seek-thumbnail');

/**
 * Cue parsed from WebVTT.
 */
type WebVTTCue = {
  startTime: number;
  endTime: number;
  settings: Record<string, string>;
  text: string;
};

export class SeekThumbnailsManager {
  private thumbnails_: { startTime: number; endTime: number; url: URL }[] = [];
  private container_: HTMLDivElement | null = null;
  private mouseMoveHandler: ((e: MouseEvent) => void) | null = null;
  private mouseLeaveHandler: (() => void) | null = null;

  /**
   * Build a new manager, fetch VTT, parse cues, create a container, and attach hover handlers.
   * Returns the newly created instance so the caller can store it.
   */
  static async initSeekThumbnails(
    player: Player,
    source: SourceOptions,
    playerOptions: IKPlayerOptions
  ): Promise<SeekThumbnailsManager | null> {
    try {
      // 1) Build the VTT URL
      const manifestUrl = await prepareSeekThumbnailVttSrc(source, playerOptions);

      log.debug('Fetching VTT →', manifestUrl);
      const resp = await fetch(manifestUrl);
      if (!resp.ok) {
        log.warn(`VTT fetch failed (${resp.status}); skipping seek thumbnails.`);
        return null;
      }
      const vttText = await resp.text();

      // 2) Parse cues
      const cues = parseWebVTT(vttText);
      if (!cues.length) {
        log.warn('No cues in VTT; skipping thumbnails.');
        return null;
      }

      // 3) Instantiate a new manager
      const mgr = new SeekThumbnailsManager();
      mgr.thumbnails_ = cues.map((c) => ({
        startTime: c.startTime,
        endTime: c.endTime,
        url: new URL(c.text),
      }));

      // 4) Remove any old container (just in case the caller forgot)
      const oldContainer = player.el().querySelector('.thumbnail-preview');
      if (oldContainer) {
        oldContainer.remove();
      }

      // 5) Create fresh container
      mgr.container_ = document.createElement('div');
      mgr.container_.className = 'thumbnail-preview';
      player.el().appendChild(mgr.container_);

      // 6) Wire up hover handlers (store references so we can remove them later)
      // @ts-ignore
      const progress = player.controlBar.progressControl;

      // Make named functions and store on `mgr`
      mgr.mouseMoveHandler = (e: MouseEvent) => onMouseMove(e, player, mgr);
      mgr.mouseLeaveHandler = () => {
        if (mgr.container_) mgr.container_.style.display = 'none';
      };

      // Attach them
      progress.on('mousemove', mgr.mouseMoveHandler);
      progress.on('mouseleave', mgr.mouseLeaveHandler);

      log.debug('SeekThumbnailsManager initialized');
      return mgr;
    } catch (err) {
      log.warn('Error initializing seek thumbnails:', err);
      return null;
    }
  }

  /**
   * Remove this manager’s container + unbind only our handlers.
   * After calling this, the caller should drop references to the instance.
   */
  public destroy(player: Player): void {
    // 1) Remove container if it exists
    if (this.container_) {
      this.container_.remove();
      this.container_ = null;
    }

    // 2) Unbind the handlers we attached
    // @ts-ignore
    const progress = player.controlBar.progressControl;
    if (this.mouseMoveHandler) {
      progress.off('mousemove', this.mouseMoveHandler);
      this.mouseMoveHandler = null;
    }
    if (this.mouseLeaveHandler) {
      progress.off('mouseleave', this.mouseLeaveHandler);
      this.mouseLeaveHandler = null;
    }

    // 3) Clear out thumbnail data
    this.thumbnails_ = [];
  }
}

/**
 * Extracts the thumbnail width from the VTT URL hash, or returns a default.
 * @param url The thumbnail URL.
 * @returns The width of the thumbnail frame.
 */
function getThumbnailWidthFromUrl(url: URL): number {
  const m = url.hash.match(/xywh=(\d+),(\d+),(\d+),(\d+)/);
  if (m && m[3]) {
    // The 'w' value from xywh=x,y,w,h
    return parseInt(m[3], 10);
  }
  // Default width if not specified in the URL hash
  return 160;
}

/**
 * Handle hover over the progress bar.
 * Looks up the nearest thumbnail for the hovered time and renders it.
 */
/**
 * Handle hover over the progress bar.
 * Renders the thumbnail and ensures it stays within the player bounds,
 * using the dynamic width from the VTT file.
 */
function onMouseMove(e: MouseEvent, player: Player, mgr: SeekThumbnailsManager) {
  if (!mgr['container_']) return;

  const playerEl = player.el();
  const playerRect = playerEl.getBoundingClientRect(); // Get player container position
  // @ts-ignore
  const playerWidth = playerEl.offsetWidth;
  // @ts-ignore
  const barRect = player.controlBar.progressControl.el().getBoundingClientRect();
  
  const pct = Math.max(0, Math.min(1, (e.clientX - barRect.left) / barRect.width));
  const time = pct * player.duration();

  const url = nearestThumbnail(mgr['thumbnails_'], time);
  if (!url) return;

  // --- START: NEW LOGIC ---

  // 1. Get the DYNAMIC width for this specific thumbnail from its URL
  const thumbnailWidth = getThumbnailWidthFromUrl(url);
  const thumbnailHalfWidth = thumbnailWidth / 2;

  // 2. Calculate the hover position relative to the PLAYER container, not just progress bar
  // Account for progress bar's offset from player's left edge
  const progressBarLeftOffset = barRect.left - playerRect.left;
  const hoverPositionInPlayer = progressBarLeftOffset + (pct * barRect.width);

  // 3. Clamp the position using the dynamic width
  let newLeft = hoverPositionInPlayer;

  if (newLeft < thumbnailHalfWidth) {
    newLeft = thumbnailHalfWidth;
  } else if (newLeft > playerWidth - thumbnailHalfWidth) {
    newLeft = playerWidth - thumbnailHalfWidth;
  }

  // 4. Update the thumbnail element
  const container = mgr['container_']!;
  container.innerHTML = '';
  const thumbEl = createThumbnailElement(document, url);
  thumbEl.className = 'thumbnail';

  container.style.left = `${newLeft}px`;
  container.style.display = 'block';
  container.appendChild(thumbEl);

  // --- END: NEW LOGIC ---
}

/** Find the cue whose startTime is closest to t */
function nearestThumbnail(
  list: { startTime: number; endTime: number; url: URL }[],
  t: number
): URL | null {
  if (!list.length) return null;
  let best = list[0],
    bestDiff = Math.abs(best.startTime - t);
  for (const item of list) {
    const d = Math.abs(item.startTime - t);
    if (d < bestDiff) {
      best = item;
      bestDiff = d;
    }
  }
  return best.url;
}

/** Render one thumbnail DIV (reads sprite coords from URL.hash) */
function createThumbnailElement(doc: Document, url: URL): HTMLDivElement {
  const div = doc.createElement('div');
  Object.assign(div.style, {
    position: 'absolute',
    pointerEvents: 'none',
    backgroundImage: `url(${url.toString()})`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: 'auto',
    transform: 'translateX(-50%) translateY(-100%)',
    backgroundPosition: 'center center',
    width: '160px',
    height: '90px',
    display: 'block',
  });

  const m = url.hash.match(/xywh=(\d+),(\d+),(\d+),(\d+)/);
  if (m) {
    const [, x, y, w, h] = m;
    div.style.width = `${w}px`;
    div.style.height = `${h}px`;
    div.style.backgroundPosition = `-${x}px -${y}px`;
    // Removed bottom style - translateY(-100%) already positions it correctly above container
  }
  return div;
}

/** Parse a WebVTT text blob into cue objects */
function parseWebVTT(input: string): WebVTTCue[] {
  const raw = input
    .replace(/\r\n|\r|\n/g, '\n')
    .replace(/\n\n+/g, '\n\n')
    .split('\n\n');
  const cueChunks = raw.filter((chunk) =>
    /\d{2}:\d{2}:\d{2}\.\d+ --> \d{2}:\d{2}:\d{2}\.\d+/.test(chunk)
  );
  return cueChunks.map(parseCue);
}

/** Parse one cue block */
function parseCue(chunk: string): WebVTTCue {
  const lines = chunk.split('\n');
  const idx = lines.findIndex((l) => / --> /.test(l));
  const [startRaw, endRaw] = lines[idx].split('-->').map((s) => s.trim());
  return {
    startTime: parseTimestamp(startRaw),
    endTime: parseTimestamp(endRaw),
    settings: {}, // unused for now
    text: lines.slice(idx + 1).join('\n'),
  };
}

/** Convert "hh:mm:ss.mmm" → seconds */
function parseTimestamp(ts: string): number {
  const [h, m, s] = ts.split(':');
  return Number(h) * 3600 + Number(m) * 60 + parseFloat(s);
}