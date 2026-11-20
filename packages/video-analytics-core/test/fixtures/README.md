# Golden fixtures

One file per section of `../SCENARIOS-SPEC.md`, each an array with one scenario per row of that
section. A scenario is a timed list of player signals and the per-view metrics the dashboard must
show for it, and `rows`: every row the tracker sent for it.

| File | Rows |
|---|---|
| `views.json` | V1–V9 |
| `playing-time.json` | P1–P8 |
| `rebuffering.json` | R1–R8 |
| `seeking.json` | S1–S9 |
| `lifecycle.json` | L1–L9 |

The web core runs them with `yarn test` (`../run-fixtures.ts`); the Android and iOS ports must
run the same files with the same rules and get the same numbers and the same rows.

## Scenario format

Each file is an array of these:

```json
{
  "id": "R2",
  "title": "Stall, pause, resume",
  "player": { "sourceUrl": "...", "durationMs": 60000, "bitrate": 2000000 },
  "signals": [{ "t": 0, "type": "load_start" }, { "t": 5000, "type": "waiting" }],
  "expected": [{ "startupMs": 0, "playingMs": 7000, "rebufferCount": 1, "rebufferMs": 3000 }],
  "knownBug": "optional: why this fixture is expected to fail for now"
}
```

`player` is optional (defaults: a fixed source URL, 60,000 ms long, no bitrate). `playheadStepMs`
makes the player report its playhead rounded down to that step, as some players do. `yarn test R2 S4`
runs only those IDs; `--verbose` also prints each view's events; `--update` rewrites `rows` in the
scenarios run whose rows changed (review the diff: it shows exactly which rows changed).

## Simulation rules

- Time `t` is ms on a virtual clock that drives the tracker's clock and its timers. Wall time is
  2026-01-01T00:00:00Z + `t`.
- The tracker's timers run only through `clock.schedule`, on that virtual clock. Any other timer
  (web: global `setTimeout`/`setInterval`) fails the fixture.
- `player_ready` is sent at `t` 0, before the first signal.
- The monotonic clock also starts at 0; the platform reports page load time 0.
- The playhead advances 1 ms per ms × rate between `playing` and the next `pause`, `waiting`,
  `seeking`, `ended`, `error` or `dispose`. After `seeked` it resumes if it was advancing when the
  seek began.
- While it advances, the player sends `timeupdate` every 250 ms, counted from when it started.
- Timers due at `t` fire before the fixture signal at `t`.
- After the last signal the playhead stops and the clock runs 6 s more, so the last batch ships.

| Signal | Effect |
|---|---|
| `load_start` (`src`) | New source, playhead 0, then the signal |
| `play`, `playing`, `pause`, `waiting`, `ended` | The player signal (`playing` starts the playhead) |
| `seeking` (`to`) | Playhead jumps to `to` ms before the signal, as browsers report it |
| `seeked` | The player signal |
| `pause_while_seeking` | Playback stays stopped after the seek; no signal (bindings drop a pause during a seek) |
| `error` (`code`) | Fatal player error |
| `report_error` (`code`) | `tracker.reportError` (non-fatal) |
| `rendition_change` (`bitrate`) | Rendition on screen changes to `bitrate` |
| `rate` (`rate`) | Playback speed changes; no signal |
| `unload` | Lifecycle `onUnload` (web: `pagehide`, not persisted) |
| `suspend` | Lifecycle `onSuspend` (web: `pagehide` into the back/forward cache) |
| `hidden` | Lifecycle `onHidden` |
| `dispose` | Player `dispose` signal |
| `tracker_dispose` | The app calls `tracker.dispose()`; no player signal |
| `restore`, `visible`, `idle` | Nothing; marks time passing |

## Metrics

Events are grouped by `playback_id` (empty ones dropped), in the order views first appear, and
reduced the way `playback_agg_mv` and the dashboard queries do:

| Field | Rule | Default |
|---|---|---|
| `attempt` | has `play`, `viewstarted`, or an error with a code | `true` |
| `started` | has `viewstarted` | `true` |
| `exitedBeforeStart` | `play`, no `viewstarted`, no error | `false` |
| `startupFailure` | no `viewstarted`, has an error | `false` |
| `startupMs` | `video_startup_time_ms` of the first `viewstarted`; `null` on a warm-resume view | required |
| `playingMs` | max `playing_time_ms` | required |
| `rebufferCount`, `rebufferMs` | count and sum of `rebufferend` | `0` |
| `seekCount`, `seekMs` | count and sum of `seeked.seek_time_ms` | `0` |
| `errors` | error codes, in order | `[]` |
| `endReason` | `view_end_reason` of the `viewend` (`""` if none) | `"navigation"` |
| `bitrate` | Σ(bitrate × played_delta_ms) / Σ played_delta_ms, rounded; `null` if none | `null` |
| `renditionChanges` | count of `renditionchange` | `0` |

## Checked on every fixture

- No event after a view's `viewend`, except `videochange` (the old view's link to the next).
- At most one `viewend` and one `viewstarted` per view.
- `rebufferstart` and `rebufferend` alternate, and none is left open.
- All of a view's events carry the same `session_id`.
- `playing_time_ms` never decreases within a view.
- No `timeupdate` before the view's first `playing`, or after `pause`, `ended` or `error` until the next `playing`.
- Every `timeupdate` carries `played_delta_ms` > 0.
- The tracker logs no warning.

A fixture with `knownBug` is reported as `known` while it fails, and fails the run once it
passes, so the marker gets removed in the same change as the fix. It has no `rows`.

## Rows

`rows` lists the rows sent, in the order sent (decoded from the wire, across all batches), one JSON
object per line:

```
{"t": 5000, "view": "v1", "session": "s1", "order": 8, "event": "seeking", "previous_event": "timeupdate", "ms_from_previous_event": 0, "playback_time_instant_ms": 30000, "playing_time_ms": 5000, "from_position_ms": 5000}
```

- `t`: event time − 2026-01-01T00:00:00Z, in ms.
- `view`, `session`: the playback and the batch's session as aliases `v1`, `v2`, … and `s1`, `s2`, …,
  numbered in the order each id first appears (row by row; within a row: view, session, then the
  fields in order). `-` if empty.
- `order` (`event_order`), then `event`.
- Then every other field of the v1 row that is set, in wire order. Left out: `event_time`,
  `event_id` (random). `next_playback_id`, `previous_playback_id` and `previous_session_id` are
  aliases.
- Media fields (`video_source_url`, `video_source_type`, `video_width_pixels`,
  `video_height_pixels`, `video_total_duration_ms`, `video_upscale_percentage`,
  `video_downscale_percentage`, `audio_codec`, `video_codec`) are included only when they differ
  from that view's previous row.

A port's runner builds the same objects and compares them field by field.
