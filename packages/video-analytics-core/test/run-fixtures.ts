/**
 * Golden-fixture runner: feeds each scenario in test/fixtures/*.json through the real tracker on a
 * virtual clock, rebuilds the per-view metrics the way ClickHouse and the dashboard do, and
 * compares them, and the rows sent, with the fixture. Rules shared
 * with the Kotlin/Swift ports: test/fixtures/README.md.
 *
 * Usage: yarn test [ID ...] [--verbose] [--update]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createAnalyticsTracker,
  type AnalyticsPlayer,
  type AnalyticsPlatform,
  type IKAnalyticsIngestRequestV1,
  type KeyValueStorage,
  type LifecycleHandlers,
  type PlayerSignal,
} from '../src/index';
import { EVENT_FIELDS_V1 } from '../src/wire-format-v1';

const TICK_MS = 250;
const DRAIN_MS = 6000;
const EPOCH_MS = Date.UTC(2026, 0, 1);
const DEFAULT_SOURCE = 'https://ik.imagekit.io/demo/sample.mp4';
/** One file per section of SCENARIOS-SPEC.md, in its order; each holds an array of scenarios. */
const FIXTURE_FILES = ['views.json', 'playing-time.json', 'rebuffering.json', 'seeking.json', 'lifecycle.json'];

interface FixtureSignal {
  t: number;
  type: string;
  src?: string;
  to?: number;
  from?: number;
  code?: string;
  bitrate?: number;
  rate?: number;
}

interface ViewMetrics {
  attempt: boolean;
  started: boolean;
  exitedBeforeStart: boolean;
  startupFailure: boolean;
  startupMs: number | null;
  playingMs: number;
  rebufferCount: number;
  rebufferMs: number;
  seekCount: number;
  seekMs: number;
  errors: string[];
  endReason: string;
  bitrate: number | null;
  renditionChanges: number;
}

interface Fixture {
  id: string;
  title: string;
  player?: { sourceUrl?: string; durationMs?: number; bitrate?: number; playheadStepMs?: number };
  signals: FixtureSignal[];
  expected: Array<Partial<ViewMetrics> & Pick<ViewMetrics, 'startupMs' | 'playingMs'>>;
  /** Every row the tracker sent, normalized (see `fixtureRows`); written by `--update`. */
  rows?: Row[];
  knownBug?: string;
}

type Row = Record<string, unknown>;

const VIEW_DEFAULTS: Omit<ViewMetrics, 'startupMs' | 'playingMs'> = {
  attempt: true,
  started: true,
  exitedBeforeStart: false,
  startupFailure: false,
  rebufferCount: 0,
  rebufferMs: 0,
  seekCount: 0,
  seekMs: 0,
  errors: [],
  endReason: 'navigation',
  bitrate: null,
  renditionChanges: 0,
};

// ─── Virtual time: the tracker's clock and its timers ─────────────────────────

interface Timer {
  id: number;
  at: number;
  seq: number;
  fn: () => void;
  every?: number;
}

class VirtualTime {
  now = 0;
  private seq = 0;
  private nextId = 1;
  private timers = new Map<number, Timer>();

  add(fn: () => void, delayMs: number, every?: number): number {
    const id = this.nextId++;
    this.timers.set(id, { id, at: this.now + Math.max(0, delayMs || 0), seq: this.seq++, fn, every });
    return id;
  }

  cancel(id: unknown): void {
    this.timers.delete(id as number);
  }

  runUntil(t: number): void {
    for (;;) {
      let next: Timer | undefined;
      for (const timer of this.timers.values()) {
        if (timer.at > t) continue;
        if (!next || timer.at < next.at || (timer.at === next.at && timer.seq < next.seq)) next = timer;
      }
      if (!next) break;
      this.now = next.at;
      if (next.every) {
        next.at += next.every;
        next.seq = this.seq++;
      } else {
        this.timers.delete(next.id);
      }
      next.fn();
    }
    this.now = t;
  }

}

/** The core must schedule through `clock.schedule`; a global timer call fails the fixture. */
function forbidGlobalTimers(): () => void {
  const g = globalThis as Record<string, unknown>;
  const names = ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'];
  const saved = names.map((k) => [k, g[k]] as const);
  for (const k of names) {
    g[k] = () => {
      throw new Error(`global ${k} called; timers must go through clock.schedule`);
    };
  }
  return () => saved.forEach(([k, v]) => (g[k] = v));
}

// ─── Fake player: a playhead that advances 1 ms per ms (× rate) while playing ─

class FakePlayer implements AnalyticsPlayer {
  readonly software = 'fixture';
  readonly softwareVersion = '1';
  sourceUrl: string;
  durationMs: number;
  bitrate: number | undefined;
  private playheadStepMs: number;
  private listener: ((signal: PlayerSignal) => void) | null = null;
  private rate = 1;
  private basePlayheadMs = 0;
  private advancingSince: number | null = null;
  private tickTimer: number | null = null;
  private seeking = false;
  private resumeAfterSeek = false;

  constructor(
    private vt: VirtualTime,
    opts: Fixture['player'] = {}
  ) {
    this.sourceUrl = opts.sourceUrl ?? DEFAULT_SOURCE;
    this.durationMs = opts.durationMs ?? 60000;
    this.bitrate = opts.bitrate;
    this.playheadStepMs = opts.playheadStepMs ?? 0;
  }

  subscribe(listener: (signal: PlayerSignal) => void): () => void {
    this.listener = listener;
    return () => (this.listener = null);
  }

  emit(signal: PlayerSignal): void {
    this.listener?.(signal);
  }

  playheadMs(): number {
    const advanced = this.advancingSince === null ? 0 : (this.vt.now - this.advancingSince) * this.rate;
    return this.basePlayheadMs + advanced;
  }

  /** What the player reports: some players update `currentTime` only in steps. */
  reportedPlayheadMs(): number {
    const ms = this.playheadMs();
    return this.playheadStepMs ? Math.floor(ms / this.playheadStepMs) * this.playheadStepMs : ms;
  }

  get advancing(): boolean {
    return this.advancingSince !== null;
  }

  start(): void {
    if (this.advancingSince !== null) return;
    this.advancingSince = this.vt.now;
    this.tickTimer = this.vt.add(() => this.emit({ type: 'timeupdate' }), TICK_MS, TICK_MS);
  }

  stop(): void {
    if (this.advancingSince === null) return;
    this.basePlayheadMs = this.playheadMs();
    this.advancingSince = null;
    if (this.tickTimer !== null) this.vt.cancel(this.tickTimer);
    this.tickTimer = null;
  }

  load(src: string): void {
    this.stop();
    this.sourceUrl = src;
    this.basePlayheadMs = 0;
  }

  seekTo(targetMs: number): void {
    if (!this.seeking) this.resumeAfterSeek = this.advancing;
    this.seeking = true;
    this.stop();
    this.basePlayheadMs = targetMs;
  }

  /** A pause during a seek, which bindings drop: playback stays stopped after `seeked`. */
  pauseWhileSeeking(): void {
    this.resumeAfterSeek = false;
  }

  seekDone(): void {
    this.seeking = false;
    if (this.resumeAfterSeek) this.start();
  }

  setRate(rate: number): void {
    const wasAdvancing = this.advancing;
    this.stop();
    this.rate = rate;
    if (wasAdvancing) this.start();
  }

  getUiContext() {
    return { width: 960, height: 540, autoplay: false, preload: 'metadata' };
  }

  getSnapshot() {
    return { duration: this.durationMs / 1000 };
  }

  getCurrentTime(): number {
    return this.reportedPlayheadMs() / 1000;
  }

  getPlaybackRate(): number {
    return this.rate;
  }

  getBitrate(): number | undefined {
    return this.bitrate;
  }

  resetSourceState(): void {}
}

// ─── One fixture run ──────────────────────────────────────────────────────────

/** One sent row, keyed by its `EVENT_FIELDS_V1` names (null positions left out), plus the batch's session id. */
type Ev = Record<string, unknown>;

function decodeRows(request: IKAnalyticsIngestRequestV1): Ev[] {
  return request.e.map((row) => {
    const ev: Ev = { session_id: request.c.s };
    EVENT_FIELDS_V1.forEach((field, i) => {
      if (row[i] !== null && row[i] !== undefined) ev[field] = row[i];
    });
    return ev;
  });
}

interface RunOutput {
  events: Ev[];
  warnings: string[];
}

function runFixture(fx: Fixture): RunOutput {
  const vt = new VirtualTime();
  const restoreTimers = forbidGlobalTimers();
  const events: Ev[] = [];
  const warnings: string[] = [];
  let lifecycle: LifecycleHandlers | null = null;
  const memory = new Map<string, string>();
  const storage: KeyValueStorage = {
    getItem: (k) => memory.get(k) ?? null,
    setItem: (k, v) => void memory.set(k, v),
    removeItem: (k) => void memory.delete(k),
  };
  const platform: AnalyticsPlatform = {
    clock: {
      now: () => EPOCH_MS + vt.now,
      monotonicNow: () => vt.now,
      schedule: (fn, delayMs) => {
        const id = vt.add(fn, delayMs);
        return () => vt.cancel(id);
      },
    },
    storage,
    lifecycle: {
      subscribe(handlers) {
        lifecycle = handlers;
        return () => (lifecycle = null);
      },
    },
    transport: {
      supportsCompression: true,
      send(request: IKAnalyticsIngestRequestV1) {
        events.push(...decodeRows(request));
        return Promise.resolve({ jsonBytes: 0, urlBytes: 0, gzipped: true });
      },
    },
    log: (level, message) => {
      if (level === 'warn') warnings.push(message);
    },
    getDeviceContext: () => ({
      page_url: 'https://example.com/',
      device_display_width: 1920,
      device_display_height: 1080,
      device_display_dpr: 1,
      user_agent: 'fixture',
    }),
    getPageLoadTimeMs: () => 0,
  };

  try {
    const player = new FakePlayer(vt, fx.player);
    const tracker = createAnalyticsTracker({
      config: { userId: 'fixture' },
      imagekitId: 'fixture',
      player,
      platform,
      integration: { name: 'fixture', version: '1' },
    });
    player.emit({ type: 'player_ready' });

    for (const s of fx.signals) {
      vt.runUntil(s.t);
      applySignal(s, player, tracker, () => lifecycle);
    }
    player.stop();
    vt.runUntil(vt.now + DRAIN_MS);
  } finally {
    restoreTimers();
  }
  return { events, warnings };
}

function applySignal(
  s: FixtureSignal,
  player: FakePlayer,
  tracker: ReturnType<typeof createAnalyticsTracker>,
  lifecycle: () => LifecycleHandlers | null
): void {
  switch (s.type) {
    case 'load_start':
      player.load(s.src ?? player.sourceUrl);
      return player.emit({ type: 'load_start', sourceUrl: player.sourceUrl });
    case 'play':
      return player.emit({ type: 'play' });
    case 'playing':
      player.start();
      return player.emit({ type: 'playing' });
    case 'pause':
      player.stop();
      return player.emit({ type: 'pause' });
    case 'waiting':
      player.stop();
      return player.emit({ type: 'waiting' });
    case 'seeking':
      player.seekTo(s.to ?? 0);
      return player.emit(s.from === undefined ? { type: 'seeking' } : { type: 'seeking', fromTime: s.from / 1000 });
    case 'jump':
      return player.seekTo(s.to ?? 0);
    case 'pause_while_seeking':
      return player.pauseWhileSeeking();
    case 'seeked':
      player.seekDone();
      return player.emit({ type: 'seeked' });
    case 'ended':
      player.stop();
      return player.emit({ type: 'ended' });
    case 'error':
      player.stop();
      return player.emit({ type: 'error', error: { code: s.code ?? 'fixture_error' } });
    case 'rendition_change': {
      player.bitrate = s.bitrate;
      return player.emit({ type: 'rendition_change' });
    }
    case 'rate':
      return player.setRate(s.rate ?? 1);
    case 'report_error':
      return tracker.reportError({ code: s.code ?? 'fixture_reported' });
    case 'unload':
      return lifecycle()?.onUnload();
    case 'suspend':
      return lifecycle()?.onSuspend();
    case 'hidden':
      return lifecycle()?.onHidden();
    case 'dispose':
      player.stop();
      return player.emit({ type: 'dispose' });
    case 'tracker_dispose':
      return tracker.dispose();
    case 'restore':
    case 'visible':
    case 'idle':
      return;
    default:
      throw new Error(`unknown fixture signal "${s.type}"`);
  }
}

// ─── Metrics, as playback_agg_mv + dashboard queries compute them ─────────────

function groupByPlayback(events: Ev[]): Map<string, Ev[]> {
  const views = new Map<string, Ev[]>();
  for (const e of events) {
    const id = e.playback_id as string | undefined;
    if (!id) continue;
    if (!views.has(id)) views.set(id, []);
    views.get(id)!.push(e);
  }
  return views;
}

function metricsFor(evs: Ev[]): ViewMetrics {
  const num = (v: unknown): number => (typeof v === 'number' && isFinite(v) ? v : 0);
  const of = (name: string) => evs.filter((e) => e.event === name);
  const started = of('viewstarted').length > 0;
  const hasPlay = of('play').length > 0;
  const errors = of('error')
    .map((e) => String(e.error_code ?? ''))
    .filter((c) => c !== '');
  const viewstarted = of('viewstarted')[0];
  // Dashboard startup queries skip warm-resume views (is_resumed_playback = previous_session_id != '').
  const resumed = evs.some((e) => typeof e.previous_session_id === 'string' && e.previous_session_id !== '');
  let bitrateWeight = 0;
  let bitrateSum = 0;
  for (const e of evs) {
    if (num(e.bitrate) > 0 && num(e.played_delta_ms) > 0) {
      bitrateSum += num(e.bitrate) * num(e.played_delta_ms);
      bitrateWeight += num(e.played_delta_ms);
    }
  }
  const endReasons = of('viewend')
    .map((e) => String(e.view_end_reason ?? ''))
    .sort();
  return {
    attempt: hasPlay || started || errors.length > 0,
    started,
    exitedBeforeStart: hasPlay && !started && errors.length === 0,
    startupFailure: !started && errors.length > 0,
    startupMs:
      viewstarted && !resumed && viewstarted.video_startup_time_ms != null ? num(viewstarted.video_startup_time_ms) : null,
    playingMs: Math.max(0, ...evs.map((e) => num(e.playing_time_ms))),
    rebufferCount: of('rebufferend').length,
    rebufferMs: of('rebufferend').reduce((a, e) => a + num(e.rebuffer_duration_ms), 0),
    seekCount: of('seeked').length,
    seekMs: of('seeked').reduce((a, e) => a + num(e.seek_time_ms), 0),
    errors,
    endReason: endReasons[endReasons.length - 1] ?? '',
    bitrate: bitrateWeight > 0 ? Math.round(bitrateSum / bitrateWeight) : null,
    renditionChanges: of('renditionchange').length,
  };
}

// `videochange` is the old view's link record to the next view, sent right after its viewend.
const ALLOWED_AFTER_VIEWEND = new Set(['videochange']);

function invariantViolations(views: Map<string, Ev[]>): string[] {
  const out: string[] = [];
  let index = 0;
  for (const evs of views.values()) {
    index++;
    const v = `view ${index}`;
    const endAt = evs.findIndex((e) => e.event === 'viewend');
    if (endAt >= 0) {
      const after = evs.slice(endAt + 1).filter((e) => !ALLOWED_AFTER_VIEWEND.has(String(e.event)));
      if (after.length) out.push(`${v}: ${after.length} event(s) after viewend (${after.map((e) => e.event).join(', ')})`);
    }
    const count = (name: string) => evs.filter((e) => e.event === name).length;
    if (count('viewend') > 1) out.push(`${v}: ${count('viewend')} viewend`);
    if (count('viewstarted') > 1) out.push(`${v}: ${count('viewstarted')} viewstarted`);
    const sessions = new Set(evs.map((e) => e.session_id));
    if (sessions.size > 1) out.push(`${v}: events split across ${sessions.size} session_ids`);
    let open = false;
    for (const e of evs) {
      if (e.event === 'rebufferstart') {
        if (open) out.push(`${v}: rebufferstart while one is open`);
        open = true;
      } else if (e.event === 'rebufferend') {
        if (!open) out.push(`${v}: rebufferend without rebufferstart`);
        open = false;
      }
    }
    if (open) out.push(`${v}: rebufferstart never closed`);
    let playing = false;
    for (const e of evs) {
      if (e.event === 'playing') playing = true;
      else if (e.event === 'pause' || e.event === 'ended' || e.event === 'error') playing = false;
      else if (e.event === 'timeupdate' && !playing) out.push(`${v}: timeupdate while not playing`);
      if (e.event === 'timeupdate' && !(Number(e.played_delta_ms) > 0)) out.push(`${v}: timeupdate with nothing played`);
    }
    let last = -1;
    for (const e of evs) {
      if (typeof e.playing_time_ms !== 'number') continue;
      if (e.playing_time_ms < last) out.push(`${v}: playing_time_ms went down (${last} → ${e.playing_time_ms})`);
      last = e.playing_time_ms;
    }
  }
  return out;
}

// ─── Rows: every row sent, normalized so runs and platforms compare equal ─────

const ROW_ID_FIELDS: Partial<Record<string, 'v' | 's'>> = {
  next_playback_id: 'v',
  previous_playback_id: 'v',
  previous_session_id: 's',
};
const ROW_OMITTED = new Set(['event_time', 'event_order', 'event_id', 'event', 'playback_id']);
// Constant within a view, so kept only when they change, to keep the rows short.
const ROW_MEDIA_FIELDS = new Set([
  'video_source_url',
  'video_source_type',
  'video_width_pixels',
  'video_height_pixels',
  'video_total_duration_ms',
  'video_upscale_percentage',
  'video_downscale_percentage',
  'audio_codec',
  'video_codec',
]);

function fixtureRows(events: Ev[]): Row[] {
  const aliases = new Map<string, string>();
  const counts = { v: 0, s: 0 };
  const alias = (kind: 'v' | 's', id: unknown): string => {
    if (typeof id !== 'string' || id === '') return '-';
    const key = `${kind}:${id}`;
    if (!aliases.has(key)) aliases.set(key, `${kind}${++counts[kind]}`);
    return aliases.get(key)!;
  };
  const lastMedia = new Map<string, Record<string, string>>();

  return events.map((e) => {
    const view = alias('v', e.playback_id);
    const media = lastMedia.get(view) ?? {};
    lastMedia.set(view, media);
    const row: Row = {
      t: Number(e.event_time) - EPOCH_MS,
      view,
      session: alias('s', e.session_id),
      order: e.event_order,
      event: e.event,
    };
    for (const field of EVENT_FIELDS_V1) {
      const value = e[field];
      if (ROW_OMITTED.has(field) || value === undefined || value === null) continue;
      const idKind = ROW_ID_FIELDS[field];
      const shown = idKind ? alias(idKind, value) : value;
      if (ROW_MEDIA_FIELDS.has(field)) {
        const key = JSON.stringify(shown);
        if (media[field] === key) continue;
        media[field] = key;
      }
      row[field] = shown;
    }
    return row;
  });
}

/** JSON with a space after `:` and `,`, the style of the fixture files. */
function compactJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(compactJson).join(', ')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value).map(([k, v]) => `${JSON.stringify(k)}: ${compactJson(v)}`).join(', ')}}`;
  }
  return JSON.stringify(value);
}

const ONE_PER_LINE = new Set(['signals', 'expected', 'rows']);

/** Writes fixtures in the hand-written layout: one signal, view or row per line. */
function formatFixtures(fixtures: Fixture[]): string {
  const field = ([key, value]: [string, unknown]) =>
    ONE_PER_LINE.has(key)
      ? `    ${JSON.stringify(key)}: [\n${(value as unknown[]).map((x) => `      ${compactJson(x)}`).join(',\n')}\n    ]`
      : `    ${JSON.stringify(key)}: ${compactJson(value)}`;
  const fixture = (fx: Fixture) => `  {\n${Object.entries(fx).map(field).join(',\n')}\n  }`;
  return `[\n${fixtures.map(fixture).join(',\n')}\n]\n`;
}

function diffRows(expected: Row[] | undefined, actual: Row[]): string[] {
  if (!expected) return ['rows: none yet (yarn test --update)'];
  const want = expected.map(compactJson);
  const got = actual.map(compactJson);
  const at = got.findIndex((row, i) => row !== want[i]);
  if (at < 0 && got.length === want.length) return [];
  const i = at < 0 ? got.length : at;
  return [
    `rows: row ${i + 1} differs (${want.length} rows expected, ${got.length} sent)`,
    `  expected: ${want[i] ?? '(none)'}`,
    `  sent:     ${got[i] ?? '(none)'}`,
  ];
}

// ─── Compare and report ───────────────────────────────────────────────────────

function diffViews(expected: Fixture['expected'], actual: ViewMetrics[]): string[] {
  const out: string[] = [];
  if (expected.length !== actual.length) out.push(`views: expected ${expected.length}, got ${actual.length}`);
  for (let i = 0; i < Math.min(expected.length, actual.length); i++) {
    const want: ViewMetrics = { ...VIEW_DEFAULTS, ...expected[i] } as ViewMetrics;
    for (const key of Object.keys(want) as Array<keyof ViewMetrics>) {
      const w = JSON.stringify(want[key]);
      const a = JSON.stringify(actual[i][key]);
      if (w !== a) out.push(`view ${i + 1} ${key}: expected ${w}, got ${a}`);
    }
  }
  return out;
}

function main(): void {
  const dir = process.env.FIXTURES_DIR!;
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose');
  const update = args.includes('--update');
  const only = args.filter((a) => !a.startsWith('--'));
  const selected = (fx: Fixture) => only.length === 0 || only.includes(fx.id);
  const files = FIXTURE_FILES.map((name) => {
    const path = join(dir, name);
    const all = JSON.parse(readFileSync(path, 'utf8')) as Fixture[];
    return { all, path, changed: false };
  });
  const fixtures = files.flatMap((file) => file.all.filter(selected).map((fx) => ({ fx, file })));

  let unexpected = 0;
  let updated = 0;
  const rows: string[] = [];
  for (const { fx, file } of fixtures) {
    const { events, warnings } = runFixture(fx);
    const views = groupByPlayback(events);
    const actual = [...views.values()].map(metricsFor);
    const sentRows = fixtureRows(events);
    // A known bug's rows are wrong by definition, so it has none.
    let rowProblems = fx.knownBug ? [] : diffRows(fx.rows, sentRows);
    if (update && !fx.knownBug && rowProblems.length) {
      updated++;
      fx.rows = sentRows;
      file.changed = true;
      rowProblems = [];
    }
    const problems = [
      ...diffViews(fx.expected, actual),
      ...invariantViolations(views),
      ...warnings.map((w) => `warning: ${w}`),
      ...rowProblems,
    ];
    const pass = problems.length === 0;
    let status: string;
    if (fx.knownBug) {
      status = pass ? 'FIXED?' : 'known';
      if (pass) unexpected++;
    } else {
      status = pass ? 'pass' : 'FAIL';
      if (!pass) unexpected++;
    }
    rows.push(`${status.padEnd(6)} ${fx.id.padEnd(4)} ${fx.title}`);
    if (fx.knownBug && !pass) rows.push(`         known bug: ${fx.knownBug}`);
    if (fx.knownBug && pass) rows.push('         passes now: remove "knownBug" from the fixture');
    for (const p of problems) rows.push(`         ${p}`);
    if (verbose) {
      let i = 0;
      for (const evs of views.values()) {
        rows.push(`         view ${++i}: ${evs.map((e) => e.event).join(' ')}`);
      }
    }
  }
  for (const file of files) {
    if (file.changed) writeFileSync(file.path, formatFixtures(file.all));
  }
  console.log(rows.join('\n'));
  const known = fixtures.filter(({ fx }) => fx.knownBug).length;
  const summary = `${fixtures.length} fixtures (${known} known bugs), ${unexpected} unexpected`;
  console.log(`\n${summary}${update ? `, ${updated} fixture(s) given new rows` : ''}`);
  process.exitCode = unexpected > 0 ? 1 : 0;
}

main();
