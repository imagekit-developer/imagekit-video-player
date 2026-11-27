# Analytics core scenarios: spec

The behaviour every ImageKit analytics SDK (web, Android, iOS) must reproduce. Each row becomes a
golden fixture: a timed list of player signals fed to the core, and the per-view numbers the
dashboard should show. The same fixture files run on every platform.

Review each row's **Expected** column. That is the contract. Each row has a scenario in `fixtures/<section>.json`
(format and simulation rules in `fixtures/README.md`); `yarn test` in this package runs them all.

## How to read a row

- **Scenario** is a timeline in ms. `ls` = `load_start`, `pl` = `play`, `pg` = `playing`,
  `w` = `waiting`, `pa` = `pause`, `sk`/`sd` = `seeking`/`seeked`, `end` = `ended`,
  `err` = native error, `leave` = page hide. Between `pg` and the next stop, the playhead advances
  1 ms per ms.
- **Expected** lists only what the scenario is about. Everything not listed is the default:
  1 view, not exited before start, 0 rebuffers, no error, view ends with `navigation`.

## Metrics

| Metric | Rule |
|---|---|
| Attempt | The view has a `play`, a first frame, or an error |
| Startup | `play` → first `playing`, once per view |
| Exited before start | Attempt with no first frame |
| Playing time | Playhead advance while playing; seeks excluded |
| Rebuffer | `waiting` after the first frame, while playing, lasting at least 250 ms. Ends at `playing`, `pause`, `seeking`, error or view end |
| Seek latency | `seeking` → `seeked`; a burst of `seeking` is one seek |
| Bitrate | Time-weighted bitrate of the rendition on screen |

## 1. Views and startup

| ID | Scenario | Expected |
|---|---|---|
| V1 | ls 0, pl 10, pg 510, end at playhead 12,500, leave 14,000 | Startup 500; playing 12,500 |
| V2 | ls 0, leave 10,000 | Not an attempt |
| V3 | ls 0, pl 5,000, pg 5,400, leave 8,000 | Startup 400; playing 2,600 |
| V4 | pl 1,000, ls 4,000, pg 8,300 (`play` before `ls`: only a play on the `<video>` itself, e.g. app code; the web adapter sends `ls` first for a held play) | 1 view, opened at `ls`; the early `play` is dropped; startup 4,300 (from `ls`, no `play` in the view) |
| V5 | pl 1,000, leave 2,500 (before `ls`) | No view (the core needs `ls` first) |
| V6 | ls 0, err 500, no play | Attempt; startup failure; view ends `error` |
| V7 | ls 0, pl 10, err 2,000 | Startup failure; view ends `error` |
| V8 | ls 0, pl 10, pg 510, err 5,510 | Started; playback failure; playing 5,000 |
| V9 | ls 0, reported (non-fatal) error 500, no play | Attempt; startup failure unless the code is a business exception |

## 2. Playing time

| ID | Scenario | Expected |
|---|---|---|
| P1 | ls 0, pl 0, pg 0, pa 3,700, pl 5,700, pg 5,700, leave 10,000 | Playing 8,000 |
| P2 | pg 0, sk 5,900 → 60%, sd 6,000, pg 6,000, sk 9,300 → 10%, sd 9,400, pg 9,400, leave 13,500 | Playing 13,300; 2 seeks |
| P3 | pg 0, end at 12,500, sk → 0, pl, pg, leave after 3,000 more | 1 view; 1 startup; 1 seek (to 0); playing 15,500 |
| P4 | pg 0, last `timeupdate` at playhead 4,750, sk 5,000 (or pa, err, leave) | Playing 5,000 |
| P5 | rate 2× from 0, sk 4,990, sd 5,000, pg 5,000, leave 7,000 | Playing 13,980 (playhead advance: 9,980 + 4,000) |
| P6 | rate 4× from 0, pa 5,000, leave 6,000 | Playing 20,000 |
| P7 | rate 4× at 3,050, back to 1× at 6,050 (between ticks), pa 9,000, leave 10,000 | Playing 18,000 (3,050 + 12,000 + 2,950) |
| P8 | playhead reported in 250 ms steps, pa 5,100, leave 6,000 | Playing 5,000 (last reported step) |

## 3. Rebuffering

| ID | Scenario | Expected |
|---|---|---|
| R1 | pg 0, w 5,000, pg 8,000 | 1 rebuffer, 3,000 |
| R2 | pg 0, w 5,000, pa 8,000, pl 11,000, pg 11,000 | 1 rebuffer, 3,000 (ends at pause) |
| R3 | pg 0, w 5,000, pa 8,000, pl 11,000, w 11,000, pg 16,000 (resumed while still stalled) | 1 rebuffer, 3,000; the wait after resume is not a rebuffer |
| R4 | pg 0, w 5,000, sk 8,000, sd 13,000, pg 13,000, leave 15,000 | 1 rebuffer, 3,000 (ends at seek); seek latency 5,000; playing 7,000 |
| R5 | pg 0, w 5,000, leave 10,000 | 1 rebuffer, 5,000 (ends at view end); playing 5,000 |
| R6 | pg 0, w 5,000, pa 8,000, pl 11,000, pg 11,000, w 40,000, pg 42,000 | 2 rebuffers, 5,000 |
| R7 | pg 0, sk 6,000, sd 6,010, pg 6,010, w 6,010, pg 6,011 (blip after a seek) | 0 rebuffers |
| R8 | pg 0, w 5,000, pg 5,200 | 0 rebuffers (under 250 ms) |

## 4. Seeking

| ID | Scenario | Expected |
|---|---|---|
| S1 | pg 0, sk 5,000, sd 5,114, pg 5,114 | 1 seek, 114 |
| S2 | pg 0, pa 4,000, sk 5,000, sd 5,100, leave 8,000 | 1 seek, 100; stays paused; playing 4,000 |
| S3 | pg 0, then 5 seeks 50 ms apart, each `sd` before the next `sk` | 5 seeks, total = sum of each; `from_position_ms` = position left |
| S4 | pg 0, sk 5,000, sk 5,050, sk 5,100, sd 5,300 (drag, no `sd` in between) | 1 seek, 200 (from the last `sk`, when the viewer let go) |
| S5 | pg 0, end at 12,500, sk → 0, sd, sk → 5,000, sd, stay paused, leave 40,000 | Playing 12,500; 2 seeks; no `timeupdate` while paused |
| S6 | pg 0, sk 3,000 (no `sd`), source change 3,050, sk 4,000, sd 4,100, never played | View 2: 1 seek, 100; no `timeupdate` |
| S7 | pg 0, sk 5,000 → 20,000, pause during the seek (dropped by the binding), sd 5,100, sk 30,000 → 40,000, sd, leave 31,000 | Playing 5,000; 2 seeks; no `timeupdate` with nothing played |
| S8 | ls 0, sk → 750,000, sd, sk → 760,000, sd, pl + pg 8,000, leave 10,000 | 2 seeks, 2nd from 750,000; playing 2,000; nothing counted before `pg` |
| S9 | pg 0, end at 12,500, sk → 0, sd, `waiting` while stopped, pl + pg 10 s later | No rebuffer; playing 14,000 |
| S10 | pg 0, playhead jumps to 30,000 at 5,000 with no signal, sk at 5,100 with from 5,000 (AVPlayer notices seeks late), sd 5,200, pg 5,200, leave 8,200 | 1 seek, 100; `from_position_ms` 5,000; playing 8,000 (nothing counted across the jump) |

## 5. Lifecycle

| ID | Scenario | Expected |
|---|---|---|
| L1 | View A plays; ls (new source) 10,000, pl 10,002, pg 13,000 | 2 views; A ends `videochange`, playing 10,000 (also on its `viewend` row); B startup 2,998 |
| L2 | pg 0 at 720p; rendition 1080p on screen at 10,000; leave 20,000 | Bitrate = 50% 720p + 50% 1080p; one `renditionchange` |
| L3 | pg 0, `pagehide` (persisted, bfcache) 5,000, `pageshow` 10,000, pl, pg, leave 20,000 | View stays open through bfcache; one `viewend(navigation)` at the real leave; nothing after it |
| L4 | pg 0, tab hidden 5,000–20,000, leave 25,000 | Playing 25,000; a `timeupdate` at 5,000 carries the 1,000 played since the last row; counting continues |
| L5 | pg 0, pa 1,000; 61 min idle; pl, pg 500 later, leave 3,500 later | Old view ends `sessionrotate`, playing 1,000; new session; new view, no startup time, playing 3,500 |
| L6 | pg 0, leave 5,000, then pa, pl, pg, sk, sd | One `viewend(navigation)`; nothing after it; playing 5,000 |
| L7 | pg 0, the app calls `tracker.dispose()` at 5,000 (no player signal), then pa | One `viewend(dispose)`; nothing after it; playing 5,000 |
| L8 | hidden 0 (before ls), ls + pl + pg 1,000, pa 4,300, hidden 6,000 (paused), pl + pg 9,000, leave 12,000 | Playing 6,300; no row at either hidden |
| L9 | pg 0, tab hidden 5,300, leave 12,700 while still hidden, then hidden (browsers fire it after `pagehide`) | Playing 12,700; a `timeupdate` at 5,300; nothing after `viewend` |

## Checked on every fixture

- No event after a view's `viewend`, except `videochange` (the old view's link to the next).
- At most one `viewend` and one `viewstarted` per view.
- `rebufferstart` and `rebufferend` alternate; none is left open.
- `playing_time_ms` never decreases within a view.
- The tracker logs no warning.
