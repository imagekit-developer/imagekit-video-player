/// Analytics ingest endpoint.
package let analyticsIngestUrl = "https://edge.vexio.io/b"

package let analyticsFlushIntervalMs: Double = 5000

package let analyticsMaxBatchSize = 50

package let analyticsTimeupdateThrottleMs: Double = 2000

/// Stalls shorter than this (e.g. the blip right after a seek) are not rebuffers.
package let analyticsMinRebufferMs: Double = 250

/// How often the playhead is read while playing, besides native `timeupdate`s.
package let analyticsPlayheadTickMs: Double = 100

/// Longest gap between native `timeupdate`s while playing (HTML spec: 15–250 ms); caps the time estimated at a seek.
package let analyticsMaxTimeupdateGapMs: Double = 250

/// Conservative ceiling on final GET URL bytes.
package let analyticsUrlSafeLimitBytes = 4000

/// Raw-JSON byte threshold that triggers a `size_limit` flush before another event is enqueued.
/// Sized so that after gzip + base64url expansion the final URL stays under `analyticsUrlSafeLimitBytes`.
package let analyticsRawJsonFlushThreshold = 6000

/// Session inactivity timeout. After this much wall-clock time without a meaningful
/// user signal (play / seeking / load_start), the next user action rotates session_id
/// and starts a new view marked `is_resumed_playback = true`. 60 min is the common industry default.
package let analyticsSessionInactivityTimeoutMs: Double = 60 * 60 * 1000

/// Hard maximum session age. Even with continuous activity the session rotates after 24 h.
package let analyticsSessionMaxAgeMs: Double = 24 * 60 * 60 * 1000

/// Minimum interval between storage activity touches. Bounds storage-write churn while
/// playing; expiry is checked at every meaningful signal so the actual rotation happens
/// close to (but never before) the inactivity window.
package let analyticsSessionActivityThrottleMs: Double = 10 * 60 * 1000
