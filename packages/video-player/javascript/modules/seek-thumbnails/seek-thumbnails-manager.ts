import videojs from 'video.js';
import type Player from 'video.js/dist/types/player';
import type { PlayerOptions, SourceOptions } from '../../interfaces';
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
    playerOptions: PlayerOptions
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
 * Handle hover over the progress bar.
 * Looks up the nearest thumbnail for the hovered time and renders it.
 */
function onMouseMove(e: MouseEvent, player: Player, mgr: SeekThumbnailsManager) {
  if (!mgr['container_']) return;

  const barRect = player.controlBar.progressControl.el().getBoundingClientRect();
  const pct = (e.clientX - barRect.left) / barRect.width;
  const time = pct * player.duration();
  const url = nearestThumbnail(mgr['thumbnails_'], time);
  if (!url) return;

  const container = mgr['container_']!;
  container.innerHTML = '';
  const thumbEl = createThumbnailElement(document, url);
  thumbEl.className = 'thumbnail';
  container.style.left = `${e.pageX - player.el().getBoundingClientRect().left}px`;
  container.style.display = 'block';
  container.appendChild(thumbEl);
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
    width: '100px',
    height: '100px',
    display: 'block',
  });

  const m = url.hash.match(/xywh=(\d+),(\d+),(\d+),(\d+)/);
  if (m) {
    const [, x, y, w, h] = m;
    div.style.width = `${w}px`;
    div.style.height = `${h}px`;
    div.style.backgroundPosition = `-${x}px -${y}px`;
    div.style.bottom = `${parseFloat(h) / 2}px`;
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