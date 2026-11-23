/**
 * Strict playback/session/view state machine for analytics.
 * Prevents invalid or duplicate events; computes timing and ordering.
 */
import type { AnalyticsEvent, IKAnalyticsEventName } from './types';
import { ANALYTICS_MIN_REBUFFER_MS } from './constants';

export type AnalyticsSignal =
  | { type: 'session_init' }
  | { type: 'session_rotated'; previousSessionId: string; videoSourceUrl?: string }
  | { type: 'player_ready'; playerStartupTimeMs: number; pageLoadTimeMs?: number }
  | { type: 'load_start'; videoSourceUrl: string; previousVideoSourceUrl?: string; isVideoChange: boolean }
  | { type: 'play' }
  | { type: 'playing' }
  | { type: 'pause' }
  | { type: 'timeupdate'; playbackTimeMs: number; playingTimeMs: number; playedDeltaMs: number; bitrate?: number }
  | { type: 'seeking'; fromPositionMs: number }
  | { type: 'seeked'; toPositionMs: number }
  | { type: 'waiting' }
  | { type: 'rebuffer_check' }
  | { type: 'renditionchange'; bitrate?: number }
  | { type: 'ended' }
  | { type: 'error'; errorCode: string; errorMessage?: string; errorContext?: string }
  | { type: 'report_error'; errorCode: string; errorMessage?: string; errorContext?: string }
  | { type: 'dispose' }
  | { type: 'page_hide' }
  | { type: 'page_suspend' };

/** Signals that may still act once the current view has sent its `viewend`; every other one is dropped. */
const SIGNALS_AFTER_VIEWEND = new Set<AnalyticsSignal['type']>([
  'session_init',
  'session_rotated',
  'player_ready',
  'load_start',
  'dispose',
  'page_hide',
]);

type PlaybackPhase =
  | 'idle'           // no view yet
  | 'view_open'      // viewinit emitted, waiting for play
  | 'play_requested' // play emitted
  | 'playing'        // actively playing
  | 'paused'
  | 'seeking'
  | 'buffering'      // rebuffer open
  | 'ended'
  | 'errored'
  | 'disposed';

export interface AnalyticsStateMachineCallbacks {
  onSessionInit: () => void;
  onEvent: (event: AnalyticsEvent) => void;
}

export interface AnalyticsStateMachineIds {
  eventId: () => string;
  playbackId: () => string;
}

export class AnalyticsStateMachine {
  private callbacks_: AnalyticsStateMachineCallbacks;
  private sessionInitialized_ = false;
  private playerReady_ = false;
  private phase_: PlaybackPhase = 'idle';
  // Stamped on every event. Before the first view it is the id that view will get, so
  // `sessioninit` and `playerready` carry it.
  private playbackId_: string;
  private hasView_ = false;
  private hasLoadedSource_ = false;
  private hasEmittedViewStarted_ = false;
  // Guards against a duplicate viewend for the same view (e.g. page_hide then dispose).
  private viewEndEmitted_ = false;
  private rebufferOpen_ = false;
  private rebufferReported_ = false;
  private rebufferStartMonotonic_ = 0;
  private seekOpen_ = false;
  private seekStartMonotonic_ = 0;
  private phaseBeforeSeek_: PlaybackPhase | null = null;
  // Video startup is measured from the view's last `play`, or from its `load_start` if it has none.
  private playStartMonotonic_: number | null = null;
  private lastEventMonotonic_ = 0;
  private lastEventName_: IKAnalyticsEventName | null = null;
  private eventOrder_ = 0;
  private ids_: AnalyticsStateMachineIds;
  private monotonicNow_: () => number;

  /**
   * Predecessor links stamped onto every event of the active view.
   *   - cold start:                    both undefined
   *   - videochange continuation:      previousPlaybackId_ set, previousSessionId_ undefined
   *   - 60-min-idle warm resume:       both set
   * Cleared when the next cold view opens; re-set when videochange / rotation occurs.
   */
  private previousPlaybackId_: string | undefined;
  private previousSessionId_: string | undefined;

  constructor(callbacks: AnalyticsStateMachineCallbacks, ids: AnalyticsStateMachineIds, monotonicNow: () => number) {
    this.callbacks_ = callbacks;
    this.ids_ = ids;
    this.monotonicNow_ = monotonicNow;
    this.playbackId_ = ids.playbackId();
  }

  dispatch(signal: AnalyticsSignal, captureContext?: () => Partial<AnalyticsEvent>): void {
    const now = this.monotonicNow_();
    const ctx = captureContext?.() ?? {};

    const emit = (event: IKAnalyticsEventName, payload: Partial<AnalyticsEvent> = {}): void => {
      const msFromPrev = this.lastEventMonotonic_ ? Math.round(now - this.lastEventMonotonic_) : 0;
      this.eventOrder_ += 1;
      const eventId = this.ids_.eventId();
      // Stamp predecessor links on every event of a non-cold-start view so the
      // server-side row carries them (they travel in the per-event wire row,
      // not the batch context). Empty strings are skipped — only set when known.
      const linkStamp: Partial<AnalyticsEvent> = {};
      if (this.previousPlaybackId_) linkStamp.previous_playback_id = this.previousPlaybackId_;
      if (this.previousSessionId_) linkStamp.previous_session_id = this.previousSessionId_;
      this.callbacks_.onEvent({
        event,
        event_id: eventId,
        playback_id: this.playbackId_,
        event_order: this.eventOrder_,
        previous_event: this.lastEventName_ ?? undefined,
        ms_from_previous_event: msFromPrev,
        ...linkStamp,
        ...ctx,
        ...payload,
      } as AnalyticsEvent);
      this.lastEventMonotonic_ = now;
      this.lastEventName_ = event;
    };

    // A stall is reported only once it has lasted ANALYTICS_MIN_REBUFFER_MS.
    const reportRebufferStart = (): void => {
      if (!this.rebufferOpen_ || this.rebufferReported_) return;
      if (now - this.rebufferStartMonotonic_ < ANALYTICS_MIN_REBUFFER_MS) return;
      this.rebufferReported_ = true;
      emit('rebufferstart');
    };
    // A stall also ends when the viewer pauses or seeks, or the view ends. Left open,
    // it would never be reported and would hide every later stall in the view.
    const closeOpenRebuffer = (): void => {
      reportRebufferStart();
      if (!this.rebufferOpen_) return;
      this.rebufferOpen_ = false;
      if (this.rebufferReported_) {
        emit('rebufferend', { rebuffer_duration_ms: Math.round(now - this.rebufferStartMonotonic_) });
      }
    };

    if (this.viewEndEmitted_ && !SIGNALS_AFTER_VIEWEND.has(signal.type)) return;

    switch (signal.type) {
      case 'session_init':
        if (this.sessionInitialized_) return;
        this.sessionInitialized_ = true;
        this.callbacks_.onSessionInit();
        emit('sessioninit');
        return;

      case 'session_rotated': {
        // Inactivity timeout elapsed. We close the prior view, re-emit sessioninit,
        // and open a fresh warm-resume view. The tracker defers flipping to the new
        // session_id until onSessionInit (below), so the closing viewend keeps the
        // OLD view's identity. `playerready` is NOT re-emitted (player instance is still alive).
        const oldPlaybackId = this.hasView_ ? this.playbackId_ : undefined;
        if (this.hasView_ && this.phase_ !== 'errored' && this.phase_ !== 'disposed') {
          // Emit a viewend on the OLD view BEFORE flipping predecessor links. We
          // do not want this viewend to carry the new view's predecessor stamps.
          // It keeps the live ctx (playhead/playing_time) captured for the old view.
          closeOpenRebuffer();
          emit('viewend', { view_end_reason: 'sessionrotate' });
        }
        this.sessionInitialized_ = true;
        this.callbacks_.onSessionInit();
        // Open the new view BEFORE emitting sessioninit so that eventOrder_ is reset to 0
        // first — giving sessioninit order=1, viewinit order=2, etc.
        this.openView(this.ids_.playbackId());
        // New view starts fresh: override the captured ctx playhead with 0 so these
        // events don't inherit the old view's position.
        emit('sessioninit', { playback_time_instant_ms: 0, playing_time_ms: 0 });
        this.previousPlaybackId_ = oldPlaybackId;
        this.previousSessionId_ = signal.previousSessionId || undefined;
        emit('viewinit', {
          playback_time_instant_ms: 0,
          playing_time_ms: 0,
          ...(signal.videoSourceUrl ? { video_source_url: signal.videoSourceUrl } : {}),
        });
        return;
      }

      case 'player_ready':
        if (this.playerReady_) return;
        this.playerReady_ = true;
        emit('playerready', {
          page_load_time_ms: signal.pageLoadTimeMs ?? 0,
          player_startup_time_ms: signal.playerStartupTimeMs,
        });
        return;

      case 'load_start': {
        if (this.phase_ === 'disposed') return;
        const oldPlaybackId = this.hasView_ ? this.playbackId_ : undefined;
        // The first source takes the id `sessioninit` already carries.
        const playbackId = this.hasLoadedSource_ ? this.ids_.playbackId() : this.playbackId_;
        this.hasLoadedSource_ = true;
        if (signal.isVideoChange && oldPlaybackId) {
          if (this.phase_ !== 'errored') {
            closeOpenRebuffer();
            emit('viewend', { view_end_reason: 'videochange', video_source_url: signal.previousVideoSourceUrl });
          }
          emit('videochange', {
            video_source_url: signal.previousVideoSourceUrl,
            new_video_source_url: signal.videoSourceUrl,
            next_playback_id: playbackId,
          });
        }
        // Set predecessor links for the NEW view:
        //   - videochange  → previous_playback_id = old pb, previous_session_id = '' (same session)
        //   - cold start   → both cleared
        if (signal.isVideoChange && oldPlaybackId) {
          this.previousPlaybackId_ = oldPlaybackId;
          this.previousSessionId_ = undefined;
        } else {
          this.previousPlaybackId_ = undefined;
          this.previousSessionId_ = undefined;
        }
        this.openView(playbackId);
        this.playStartMonotonic_ = now;
        emit('viewinit', { video_source_url: signal.videoSourceUrl, playing_time_ms: 0 });
        return;
      }
      case 'play':
        if (this.phase_ === 'disposed' || this.phase_ === 'errored') return;
        if (this.phase_ === 'idle') return; // must have viewopen first
        // Replay/loop after 'ended'; same view, no duplicate viewstarted.
        this.playStartMonotonic_ = now;
        emit('play', {});
        this.phase_ = 'play_requested';
        return;

      case 'playing':
        closeOpenRebuffer();
        if (!this.hasEmittedViewStarted_) {
          this.hasEmittedViewStarted_ = true;
          if (this.previousSessionId_ || this.playStartMonotonic_ === null) {
            // Warm resume: not a startup. The server ignores it (previous_session_id is set).
            emit('viewstarted', { video_startup_time_ms: 0 });
          } else {
            const videoStartupMs = Math.round(now - this.playStartMonotonic_);
            emit('viewstarted', { video_startup_time_ms: videoStartupMs });
          }
        }
        emit('playing');
        this.phase_ = 'playing';
        if (this.seekOpen_) {
          this.seekOpen_ = false;
          const toPositionMs = ctx.playback_time_instant_ms ?? 0; // already in ms
          const seekTimeMs = Math.round(now - this.seekStartMonotonic_);
          emit('seeked', { to_position_ms: toPositionMs, seek_time_ms: seekTimeMs });
        }
        return;

      case 'pause':
        if (this.phase_ === 'ended' || this.phase_ === 'disposed') return;
        if (this.phase_ === 'seeking') return;
        if (this.phase_ === 'paused') return;
        closeOpenRebuffer();
        emit('pause');
        this.phase_ = 'paused';
        return;

      case 'timeupdate':
        if (this.phase_ !== 'playing') return;
        // The row's playhead is where the counted time ended, which at a seek is no longer the player's.
        emit('timeupdate', {
          playback_time_instant_ms: signal.playbackTimeMs,
          playing_time_ms: signal.playingTimeMs,
          played_delta_ms: signal.playedDeltaMs,
          bitrate: signal.bitrate,
        });
        return;

      case 'seeking':
        if (this.phase_ === 'disposed') return;
        if (this.phase_ === 'seeking') {
          // A drag sends `seeking` for each position it passes: one seek, timed from where the viewer let go.
          this.seekStartMonotonic_ = now;
          return;
        }
        closeOpenRebuffer();
        this.phaseBeforeSeek_ = this.phase_;
        this.seekOpen_ = true;
        this.seekStartMonotonic_ = now;
        emit('seeking', { from_position_ms: signal.fromPositionMs });
        this.phase_ = 'seeking';
        return;

      case 'seeked': {
        if (!this.seekOpen_) return;
        this.seekOpen_ = false;
        const seekTimeMs = Math.round(now - this.seekStartMonotonic_);
        emit('seeked', { to_position_ms: signal.toPositionMs, seek_time_ms: seekTimeMs });
        const prior = this.phaseBeforeSeek_;
        this.phaseBeforeSeek_ = null;
        // A `play` during the seek has already moved the phase on. Otherwise playback goes back to
        // what it was doing; a seek away from the end leaves it stopped, not ended.
        if (this.phase_ === 'seeking') {
          if (prior === 'playing' || prior === 'buffering') this.phase_ = 'playing';
          else if (prior === 'ended' || prior === null) this.phase_ = 'paused';
          else this.phase_ = prior;
        }
        return;
      }

      case 'waiting':
        // Only mid-play stalls count as rebuffer; initial/resume buffering is video startup.
        if (!this.hasEmittedViewStarted_) return;
        if (this.phase_ !== 'playing') return;
        if (this.seekOpen_) return; // do not treat seek as rebuffer
        if (this.rebufferOpen_) return;
        this.rebufferOpen_ = true;
        this.rebufferReported_ = false;
        this.rebufferStartMonotonic_ = now;
        this.phase_ = 'buffering';
        return;

      case 'rebuffer_check':
        reportRebufferStart();
        return;

      case 'renditionchange':
        if (this.phase_ === 'idle' || this.phase_ === 'disposed') return;
        // No played_delta_ms: the timeupdate flushed at the switch carries the old rendition's time.
        emit('renditionchange', { bitrate: signal.bitrate });
        return;

      case 'ended':
        if (this.phase_ === 'ended' || this.phase_ === 'disposed') return;
        // 'ended' does not close the view; looping/seeking back replays on the same view.
        emit('ended');
        this.phase_ = 'ended';
        return;

      case 'error':
        if (this.phase_ === 'disposed' || this.phase_ === 'errored') return;
        closeOpenRebuffer();
        emit('error', {
          error_code: signal.errorCode,
          error_message: signal.errorMessage,
          error_context: signal.errorContext,
        });
        this.phase_ = 'errored';
        if (this.hasView_) {
          emit('viewend', { view_end_reason: 'error' });
          this.viewEndEmitted_ = true;
        }
        return;

      case 'report_error':
        // Non-terminal: view stays open. Pre-source (idle) reports are allowed.
        if (this.phase_ === 'disposed') return;
        emit('error', {
          error_code: signal.errorCode,
          error_message: signal.errorMessage,
          error_context: signal.errorContext,
        });
        return;

      case 'dispose':
        if (this.phase_ === 'disposed') return;
        if (this.phase_ !== 'errored' && !this.viewEndEmitted_ && this.hasView_) {
          closeOpenRebuffer();
          emit('viewend', { view_end_reason: 'dispose' });
          this.viewEndEmitted_ = true;
        }
        this.phase_ = 'disposed';
        return;

      case 'page_hide':
        // Tab close / navigation away. pagehide is the last reliable point to emit a
        // viewend; video.js 'dispose' does not fire before the page is torn down.
        if (this.phase_ === 'disposed' || this.phase_ === 'errored') return;
        if (!this.viewEndEmitted_ && this.hasView_) {
          closeOpenRebuffer();
          emit('viewend', { view_end_reason: 'navigation' });
          this.viewEndEmitted_ = true;
        }
        return;

      case 'page_suspend':
        // The page may never come back, so report an open stall now; the view itself stays open.
        if (this.phase_ === 'idle' || this.phase_ === 'disposed' || this.phase_ === 'errored') return;
        closeOpenRebuffer();
        return;
    }
  }

  private openView(playbackId: string): void {
    this.playbackId_ = playbackId;
    this.hasView_ = true;
    this.phase_ = 'view_open';
    this.hasEmittedViewStarted_ = false;
    this.playStartMonotonic_ = null;
    this.viewEndEmitted_ = false;
    this.rebufferOpen_ = false;
    this.seekOpen_ = false;
    this.eventOrder_ = 0;
    this.lastEventName_ = null;
    this.lastEventMonotonic_ = 0;
  }

  isPlaying(): boolean {
    return this.phase_ === 'playing' && !this.viewEndEmitted_;
  }
}
