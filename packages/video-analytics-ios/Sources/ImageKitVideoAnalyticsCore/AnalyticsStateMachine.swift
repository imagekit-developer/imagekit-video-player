// Strict playback/session/view state machine for analytics.
// Prevents invalid or duplicate events; computes timing and ordering.

package enum AnalyticsSignal {
    case sessionInit
    case sessionRotated(previousSessionId: String, videoSourceUrl: String?)
    case playerReady(playerStartupTimeMs: Double, pageLoadTimeMs: Double?)
    case loadStart(videoSourceUrl: String, previousVideoSourceUrl: String?, isVideoChange: Bool)
    case play
    case playing
    case pause
    case timeupdate(playbackTimeMs: Double, playingTimeMs: Double, playedDeltaMs: Double, bitrate: Double?)
    case seeking(fromPositionMs: Double)
    case seeked(toPositionMs: Double)
    case waiting
    case rebufferCheck
    case renditionchange(bitrate: Double?)
    case ended
    case error(errorCode: String, errorMessage: String?, errorContext: String?)
    case reportError(errorCode: String, errorMessage: String?, errorContext: String?)
    case dispose
    case pageHide
    case pageSuspend

    /// Signals that may still act once the current view has sent its `viewend`; every other one is dropped.
    fileprivate var actsAfterViewEnd: Bool {
        switch self {
        case .sessionInit, .sessionRotated, .playerReady, .loadStart, .dispose, .pageHide:
            return true
        default:
            return false
        }
    }
}

private enum PlaybackPhase {
    case idle           // no view yet
    case viewOpen       // viewinit emitted, waiting for play
    case playRequested  // play emitted
    case playing        // actively playing
    case paused
    case seeking
    case buffering      // rebuffer open
    case ended
    case errored
    case disposed
}

package struct AnalyticsStateMachineCallbacks {
    package var onSessionInit: @MainActor () throws -> Void
    package var onEvent: @MainActor (AnalyticsEvent) throws -> Void

    package init(
        onSessionInit: @escaping @MainActor () throws -> Void,
        onEvent: @escaping @MainActor (AnalyticsEvent) throws -> Void
    ) {
        self.onSessionInit = onSessionInit
        self.onEvent = onEvent
    }
}

package struct AnalyticsStateMachineIds {
    package var eventId: @MainActor () -> String
    package var playbackId: @MainActor () -> String

    package init(eventId: @escaping @MainActor () -> String, playbackId: @escaping @MainActor () -> String) {
        self.eventId = eventId
        self.playbackId = playbackId
    }
}

@MainActor
package final class AnalyticsStateMachine {
    private let callbacks: AnalyticsStateMachineCallbacks
    private var sessionInitialized = false
    private var playerReady = false
    private var phase: PlaybackPhase = .idle
    // Stamped on every event. Before the first view it is the id that view will get, so
    // `sessioninit` and `playerready` carry it.
    private var playbackId: String
    private var hasView = false
    private var hasLoadedSource = false
    private var hasEmittedViewStarted = false
    // Guards against a duplicate viewend for the same view (e.g. page_hide then dispose).
    private var viewEndEmitted = false
    private var rebufferOpen = false
    private var rebufferReported = false
    private var rebufferStartMonotonic: Double = 0
    private var seekOpen = false
    private var seekStartMonotonic: Double = 0
    private var phaseBeforeSeek: PlaybackPhase?
    // Video startup is measured from the view's last `play`, or from its `load_start` if it has none.
    private var playStartMonotonic: Double?
    private var lastEventMonotonic: Double = 0
    private var lastEventName: IKAnalyticsEventName?
    private var eventOrder = 0
    private let ids: AnalyticsStateMachineIds
    private let monotonicNow: @MainActor () -> Double

    // Predecessor links stamped onto every event of the active view.
    //   - cold start:                    both nil
    //   - videochange continuation:      previousPlaybackId set, previousSessionId nil
    //   - 60-min-idle warm resume:       both set
    // Cleared when the next cold view opens; re-set when videochange / rotation occurs.
    private var previousPlaybackId: String?
    private var previousSessionId: String?

    package init(
        _ callbacks: AnalyticsStateMachineCallbacks,
        _ ids: AnalyticsStateMachineIds,
        _ monotonicNow: @escaping @MainActor () -> Double
    ) {
        self.callbacks = callbacks
        self.ids = ids
        self.monotonicNow = monotonicNow
        self.playbackId = ids.playbackId()
    }

    package func dispatch(
        _ signal: AnalyticsSignal,
        _ captureContext: (@MainActor () -> AnalyticsEventFields)? = nil
    ) throws {
        let now = monotonicNow()
        let ctx = captureContext?() ?? AnalyticsEventFields()

        func emit(_ event: IKAnalyticsEventName, _ payload: AnalyticsEventFields = AnalyticsEventFields()) throws {
            // `lastEventMonotonic` 0 is read as "no previous event", as the TS truthiness check does.
            let msFromPrev = lastEventMonotonic != 0 && !lastEventMonotonic.isNaN
                ? jsRound(now - lastEventMonotonic)
                : 0
            eventOrder += 1
            let eventId = ids.eventId()
            // Stamp predecessor links on every event of a non-cold-start view so the
            // server-side row carries them (they travel in the per-event wire row,
            // not the batch context). Empty strings are skipped — only set when known.
            var linkStamp = AnalyticsEventFields()
            if let previousPlaybackId, !previousPlaybackId.isEmpty { linkStamp.previousPlaybackId = previousPlaybackId }
            if let previousSessionId, !previousSessionId.isEmpty { linkStamp.previousSessionId = previousSessionId }
            var analyticsEvent = AnalyticsEvent(
                event: event,
                eventId: eventId,
                playbackId: playbackId,
                eventOrder: eventOrder,
                previousEvent: lastEventName,
                msFromPreviousEvent: msFromPrev
            )
            analyticsEvent.apply(linkStamp)
            analyticsEvent.apply(ctx)
            analyticsEvent.apply(payload)
            try callbacks.onEvent(analyticsEvent)
            lastEventMonotonic = now
            lastEventName = event
        }

        // A stall is reported only once it has lasted `analyticsMinRebufferMs`.
        func reportRebufferStart() throws {
            if !rebufferOpen || rebufferReported { return }
            if now - rebufferStartMonotonic < analyticsMinRebufferMs { return }
            rebufferReported = true
            try emit(.rebufferstart)
        }
        // A stall also ends when the viewer pauses or seeks, or the view ends. Left open,
        // it would never be reported and would hide every later stall in the view.
        func closeOpenRebuffer() throws {
            try reportRebufferStart()
            if !rebufferOpen { return }
            rebufferOpen = false
            if rebufferReported {
                try emit(.rebufferend, AnalyticsEventFields(rebufferDurationMs: jsRound(now - rebufferStartMonotonic)))
            }
        }

        if viewEndEmitted && !signal.actsAfterViewEnd { return }

        switch signal {
        case .sessionInit:
            if sessionInitialized { return }
            sessionInitialized = true
            try callbacks.onSessionInit()
            try emit(.sessioninit)

        case .sessionRotated(let previousSessionIdSignal, let videoSourceUrl):
            // Inactivity timeout elapsed. We close the prior view, re-emit sessioninit,
            // and open a fresh warm-resume view. The tracker defers flipping to the new
            // session_id until onSessionInit (below), so the closing viewend keeps the
            // OLD view's identity. `playerready` is NOT re-emitted (player instance is still alive).
            let oldPlaybackId = hasView ? playbackId : nil
            if hasView && phase != .errored && phase != .disposed {
                // Emit a viewend on the OLD view BEFORE flipping predecessor links. We
                // do not want this viewend to carry the new view's predecessor stamps.
                // It keeps the live ctx (playhead/playing_time) captured for the old view.
                try closeOpenRebuffer()
                try emit(.viewend, AnalyticsEventFields(viewEndReason: .sessionrotate))
            }
            sessionInitialized = true
            try callbacks.onSessionInit()
            // Open the new view BEFORE emitting sessioninit so that eventOrder is reset to 0
            // first — giving sessioninit order=1, viewinit order=2, etc.
            openView(ids.playbackId())
            // New view starts fresh: override the captured ctx playhead with 0 so these
            // events don't inherit the old view's position.
            try emit(.sessioninit, AnalyticsEventFields(playbackTimeInstantMs: 0, playingTimeMs: 0))
            previousPlaybackId = oldPlaybackId
            previousSessionId = previousSessionIdSignal.isEmpty ? nil : previousSessionIdSignal
            var viewInit = AnalyticsEventFields(playbackTimeInstantMs: 0, playingTimeMs: 0)
            if let videoSourceUrl, !videoSourceUrl.isEmpty { viewInit.videoSourceUrl = videoSourceUrl }
            try emit(.viewinit, viewInit)

        case .playerReady(let playerStartupTimeMs, let pageLoadTimeMs):
            if playerReady { return }
            playerReady = true
            try emit(.playerready, AnalyticsEventFields(
                pageLoadTimeMs: pageLoadTimeMs ?? 0,
                playerStartupTimeMs: playerStartupTimeMs
            ))

        case .loadStart(let videoSourceUrl, let previousVideoSourceUrl, let isVideoChange):
            if phase == .disposed { return }
            let oldPlaybackId = hasView ? playbackId : nil
            // The first source takes the id `sessioninit` already carries.
            let newPlaybackId = hasLoadedSource ? ids.playbackId() : playbackId
            hasLoadedSource = true
            let isLinkedChange = isVideoChange && oldPlaybackId?.isEmpty == false
            if isLinkedChange {
                if phase != .errored {
                    try closeOpenRebuffer()
                    try emit(.viewend, AnalyticsEventFields(videoSourceUrl: previousVideoSourceUrl, viewEndReason: .videochange))
                }
                try emit(.videochange, AnalyticsEventFields(
                    videoSourceUrl: previousVideoSourceUrl,
                    newVideoSourceUrl: videoSourceUrl,
                    nextPlaybackId: newPlaybackId
                ))
            }
            // Set predecessor links for the NEW view:
            //   - videochange  → previousPlaybackId = old pb, previousSessionId nil (same session)
            //   - cold start   → both cleared
            if isLinkedChange {
                previousPlaybackId = oldPlaybackId
                previousSessionId = nil
            } else {
                previousPlaybackId = nil
                previousSessionId = nil
            }
            openView(newPlaybackId)
            playStartMonotonic = now
            try emit(.viewinit, AnalyticsEventFields(videoSourceUrl: videoSourceUrl, playingTimeMs: 0))

        case .play:
            if phase == .disposed || phase == .errored { return }
            if phase == .idle { return } // must have viewopen first
            // Replay/loop after 'ended'; same view, no duplicate viewstarted.
            playStartMonotonic = now
            try emit(.play)
            phase = .playRequested

        case .playing:
            try closeOpenRebuffer()
            if !hasEmittedViewStarted {
                hasEmittedViewStarted = true
                if previousSessionId?.isEmpty == false || playStartMonotonic == nil {
                    // Warm resume: not a startup. The server ignores it (previous_session_id is set).
                    try emit(.viewstarted, AnalyticsEventFields(videoStartupTimeMs: 0))
                } else {
                    let videoStartupMs = jsRound(now - playStartMonotonic!)
                    try emit(.viewstarted, AnalyticsEventFields(videoStartupTimeMs: videoStartupMs))
                }
            }
            try emit(.playing)
            phase = .playing
            if seekOpen {
                seekOpen = false
                let toPositionMs = (ctx.playbackTimeInstantMs ?? nil) ?? 0 // already in ms
                let seekTimeMs = jsRound(now - seekStartMonotonic)
                try emit(.seeked, AnalyticsEventFields(toPositionMs: toPositionMs, seekTimeMs: seekTimeMs))
            }

        case .pause:
            if phase == .ended || phase == .disposed { return }
            if phase == .seeking { return }
            if phase == .paused { return }
            try closeOpenRebuffer()
            try emit(.pause)
            phase = .paused

        case .timeupdate(let playbackTimeMs, let playingTimeMs, let playedDeltaMs, let bitrate):
            if phase != .playing { return }
            // The row's playhead is where the counted time ended, which at a seek is no longer the player's.
            try emit(.timeupdate, AnalyticsEventFields(
                playbackTimeInstantMs: playbackTimeMs,
                playingTimeMs: playingTimeMs,
                bitrate: bitrate,
                playedDeltaMs: playedDeltaMs
            ))

        case .seeking(let fromPositionMs):
            if phase == .disposed { return }
            if phase == .seeking {
                // A drag sends `seeking` for each position it passes: one seek, timed from where the viewer let go.
                seekStartMonotonic = now
                return
            }
            try closeOpenRebuffer()
            phaseBeforeSeek = phase
            seekOpen = true
            seekStartMonotonic = now
            try emit(.seeking, AnalyticsEventFields(fromPositionMs: fromPositionMs))
            phase = .seeking

        case .seeked(let toPositionMs):
            if !seekOpen { return }
            seekOpen = false
            let seekTimeMs = jsRound(now - seekStartMonotonic)
            try emit(.seeked, AnalyticsEventFields(toPositionMs: toPositionMs, seekTimeMs: seekTimeMs))
            let prior = phaseBeforeSeek
            phaseBeforeSeek = nil
            // A `play` during the seek has already moved the phase on. Otherwise playback goes back to
            // what it was doing; a seek away from the end leaves it stopped, not ended.
            if phase == .seeking {
                if prior == .playing || prior == .buffering {
                    phase = .playing
                } else if prior == .ended || prior == nil {
                    phase = .paused
                } else if let prior {
                    phase = prior
                }
            }

        case .waiting:
            // Only mid-play stalls count as rebuffer; initial/resume buffering is video startup.
            if !hasEmittedViewStarted { return }
            if phase != .playing { return }
            if seekOpen { return } // do not treat seek as rebuffer
            if rebufferOpen { return }
            rebufferOpen = true
            rebufferReported = false
            rebufferStartMonotonic = now
            phase = .buffering

        case .rebufferCheck:
            try reportRebufferStart()

        case .renditionchange(let bitrate):
            if phase == .idle || phase == .disposed { return }
            // No played_delta_ms: the timeupdate flushed at the switch carries the old rendition's time.
            try emit(.renditionchange, AnalyticsEventFields(bitrate: bitrate))

        case .ended:
            if phase == .ended || phase == .disposed { return }
            // 'ended' does not close the view; looping/seeking back replays on the same view.
            try emit(.ended)
            phase = .ended

        case .error(let errorCode, let errorMessage, let errorContext):
            if phase == .disposed || phase == .errored { return }
            try closeOpenRebuffer()
            try emit(.error, AnalyticsEventFields(
                errorCode: errorCode,
                errorMessage: errorMessage,
                errorContext: errorContext
            ))
            phase = .errored
            if hasView {
                try emit(.viewend, AnalyticsEventFields(viewEndReason: .error))
                viewEndEmitted = true
            }

        case .reportError(let errorCode, let errorMessage, let errorContext):
            // Non-terminal: view stays open. Pre-source (idle) reports are allowed.
            if phase == .disposed { return }
            try emit(.error, AnalyticsEventFields(
                errorCode: errorCode,
                errorMessage: errorMessage,
                errorContext: errorContext
            ))

        case .dispose:
            if phase == .disposed { return }
            if phase != .errored && !viewEndEmitted && hasView {
                try closeOpenRebuffer()
                try emit(.viewend, AnalyticsEventFields(viewEndReason: .dispose))
                viewEndEmitted = true
            }
            phase = .disposed

        case .pageHide:
            // App teardown. The last reliable point to emit a viewend; the player's
            // dispose may not fire before the host is torn down.
            if phase == .disposed || phase == .errored { return }
            if !viewEndEmitted && hasView {
                try closeOpenRebuffer()
                try emit(.viewend, AnalyticsEventFields(viewEndReason: .navigation))
                viewEndEmitted = true
            }

        case .pageSuspend:
            // The host may never come back, so report an open stall now; the view itself stays open.
            if phase == .idle || phase == .disposed || phase == .errored { return }
            try closeOpenRebuffer()
        }
    }

    private func openView(_ playbackId: String) {
        self.playbackId = playbackId
        hasView = true
        phase = .viewOpen
        hasEmittedViewStarted = false
        playStartMonotonic = nil
        viewEndEmitted = false
        rebufferOpen = false
        seekOpen = false
        eventOrder = 0
        lastEventName = nil
        lastEventMonotonic = 0
    }

    package func isPlaying() -> Bool {
        phase == .playing && !viewEndEmitted
    }
}
