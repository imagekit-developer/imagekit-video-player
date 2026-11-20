/**
 * Strict playback/session/view state machine for analytics.
 * Prevents invalid or duplicate events; computes timing and ordering.
 */
import type {
  IKAnalyticsEventName,
  InternalAnalyticsEvent,
} from './types';
import { ANALYTICS_MIN_REBUFFER_MS } from './constants';

export type AnalyticsSignal =
  | { type: 'session_init' }
  | {
      type: 'session_rotated';
      newPlaybackId: string;
      previousSessionId: string;
      videoSourceUrl?: string;
    }
  | { type: 'player_ready'; playerStartupTimeMs: number; pageLoadTimeMs?: number }
  | { type: 'load_start'; playbackId: string; videoSourceUrl: string; previousVideoSourceUrl?: string; isFirstView: boolean; isVideoChange: boolean }
  | { type: 'play' }
  | { type: 'playing' }
  | { type: 'pause' }
  | { type: 'timeupdate'; playbackTimeMs: number; playingTimeMs: number; playedDeltaMs: number; bitrate?: number }
  | { type: 'seeking'; fromPositionMs: number }
  | { type: 'seeked'; toPositionMs: number; seekTimeMs: number }
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
  onViewInit: (playbackId: string) => void;
  onVideoChange: (playbackId: string) => void;
  onEvent: (event: InternalAnalyticsEvent) => void;
}

export class AnalyticsStateMachine {
  private callbacks_: AnalyticsStateMachineCallbacks;
  private sessionInitialized_ = false;
  private playerReady_ = false;
  private phase_: PlaybackPhase = 'idle';
  private currentPlaybackId_: string | null = null;
  private hasEmittedViewStarted_ = false;
  // Guards against a duplicate viewend for the same view (e.g. page_hide then dispose).
  private viewEndEmitted_ = false;
  private rebufferOpen_ = false;
  private rebufferReported_ = false;
  private rebufferStartMonotonic_ = 0;
  private seekOpen_ = false;
  private seekStartMonotonic_ = 0;
  private seekFromPositionMs_ = 0;
  private phaseBeforeSeek_: PlaybackPhase | null = null;
  // Video startup is measured from the view's last `play`, or from its `load_start` if it has none.
  private playStartMonotonic_: number | null = null;
  private lastEventMonotonic_ = 0;
  private lastEventName_: IKAnalyticsEventName | null = null;
  private eventOrder_ = 0;
  private generateEventId_: () => string;
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
  /** Last `video_source_url` observed on `load_start`; used to label the rotated viewinit. */
  private lastVideoSourceUrl_: string | undefined;

  constructor(
    callbacks: AnalyticsStateMachineCallbacks,
    generateEventId: () => string,
    monotonicNow: () => number
  ) {
    this.callbacks_ = callbacks;
    this.generateEventId_ = generateEventId;
    this.monotonicNow_ = monotonicNow;
  }

  dispatch(signal: AnalyticsSignal, captureContext?: () => Partial<InternalAnalyticsEvent>): void {
    const now = this.monotonicNow_();
    const ctx = captureContext?.() ?? {};

    const emit = (event: IKAnalyticsEventName, payload: Partial<InternalAnalyticsEvent> = {}): void => {
      const msFromPrev = this.lastEventMonotonic_ ? Math.round(now - this.lastEventMonotonic_) : 0;
      this.eventOrder_ += 1;
      const eventId = this.generateEventId_();
      // Stamp predecessor links on every event of a non-cold-start view so the
      // server-side row carries them (they travel in the per-event wire row,
      // not the batch context). Empty strings are skipped — only set when known.
      const linkStamp: Partial<InternalAnalyticsEvent> = {};
      if (this.previousPlaybackId_) linkStamp.previous_playback_id = this.previousPlaybackId_;
      if (this.previousSessionId_) linkStamp.previous_session_id = this.previousSessionId_;
      this.callbacks_.onEvent({
        event,
        event_id: eventId,
        event_order: this.eventOrder_,
        previous_event: this.lastEventName_ ?? undefined,
        ms_from_previous_event: msFromPrev,
        ...linkStamp,
        ...ctx,
        ...payload,
      } as InternalAnalyticsEvent);
      this.lastEventMonotonic_ = now;
      this.lastEventName_ = event;
    };

    // A stall is reported only once it has lasted ANALYTICS_MIN_REBUFFER_MS.
    const reportRebufferStart = (): void => {
      if (!this.rebufferOpen_ || this.rebufferReported_) return;
      if (now - this.rebufferStartMonotonic_ < ANALYTICS_MIN_REBUFFER_MS) return;
      this.rebufferReported_ = true;
      emit('rebufferstart', ctx);
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
        // session_id / playback_id until onSessionInit (below), so the closing
        // viewend keeps the OLD view's identity. `playerready` is NOT re-emitted
        // (player instance is still alive).
        const oldPlaybackId = this.currentPlaybackId_;
        if (this.currentPlaybackId_ && this.phase_ !== 'errored' && this.phase_ !== 'disposed') {
          // Emit a viewend on the OLD view BEFORE flipping predecessor links. We
          // do not want this viewend to carry the new view's predecessor stamps.
          // It keeps the live ctx (playhead/playing_time) captured for the old view.
          closeOpenRebuffer();
          emit('viewend', { view_end_reason: 'sessionrotate' });
        }
        // Reset session-level flags so sessioninit emits again.
        this.sessionInitialized_ = false;
        this.sessionInitialized_ = true; // mark immediately so re-entrant session_init no-ops.
        this.callbacks_.onSessionInit();
        // Open the new view BEFORE emitting sessioninit so that eventOrder_ is reset to 0
        // first — giving sessioninit order=1, viewinit order=2, etc.
        this.callbacks_.onViewInit?.(signal.newPlaybackId);
        this.openView(signal.newPlaybackId);
        // New view starts fresh: override the captured ctx playhead with 0 so these
        // events don't inherit the old view's position.
        emit('sessioninit', { playback_time_instant_ms: 0, playing_time_ms: 0 });
        this.previousPlaybackId_ = oldPlaybackId ?? undefined;
        this.previousSessionId_ = signal.previousSessionId || undefined;
        const url = signal.videoSourceUrl ?? this.lastVideoSourceUrl_;
        emit('viewinit', {
          playback_time_instant_ms: 0,
          playing_time_ms: 0,
          ...(url ? { video_source_url: url } : {}),
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
        const oldPlaybackId = this.currentPlaybackId_;
        if (signal.isVideoChange && this.currentPlaybackId_) {
          if (this.phase_ !== 'errored') {
            closeOpenRebuffer();
            emit('viewend', { view_end_reason: 'videochange', video_source_url: signal.previousVideoSourceUrl });
          }
          emit('videochange', {
            video_source_url: signal.previousVideoSourceUrl,
            new_video_source_url: signal.videoSourceUrl,
            next_playback_id: signal.playbackId,
          });
          this.callbacks_.onVideoChange?.(signal.playbackId);
        } else {
          this.callbacks_.onViewInit?.(signal.playbackId);
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
        this.lastVideoSourceUrl_ = signal.videoSourceUrl;
        this.openView(signal.playbackId);
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
            // Warm resume: omit video_startup_time_ms (server MV gates it on previous_session_id = '').
            emit('viewstarted', {});
          } else {
            const videoStartupMs = Math.round(now - this.playStartMonotonic_);
            emit('viewstarted', { video_startup_time_ms: videoStartupMs });
          }
        }
        emit('playing', ctx);
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
        emit('pause', ctx);
        this.phase_ = 'paused';
        return;

      case 'timeupdate':
        if (this.phase_ !== 'playing') return;
        // The row's playhead is where the counted time ended, which at a seek is no longer the player's.
        emit('timeupdate', {
          ...ctx,
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
        this.seekFromPositionMs_ = signal.fromPositionMs;
        emit('seeking', { from_position_ms: signal.fromPositionMs });
        this.phase_ = 'seeking';
        return;

      case 'seeked': {
        if (!this.seekOpen_) return;
        this.seekOpen_ = false;
        const seekTimeMs = Math.round(now - this.seekStartMonotonic_);
        emit('seeked', {
          to_position_ms: signal.toPositionMs,
          seek_time_ms: seekTimeMs,
          ...ctx,
        });
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
        emit('renditionchange', { ...ctx, bitrate: signal.bitrate });
        return;

      case 'ended':
        if (this.phase_ === 'ended' || this.phase_ === 'disposed') return;
        // 'ended' does not close the view; looping/seeking back replays on the same view.
        emit('ended', ctx);
        this.phase_ = 'ended';
        return;

      case 'error':
        if (this.phase_ === 'disposed' || this.phase_ === 'errored') return;
        closeOpenRebuffer();
        emit('error', {
          error_code: signal.errorCode,
          error_message: signal.errorMessage,
          error_context: signal.errorContext,
          ...ctx,
        });
        this.phase_ = 'errored';
        if (this.currentPlaybackId_) {
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
          ...ctx,
        });
        return;

      case 'dispose':
        if (this.phase_ === 'disposed') return;
        if (this.phase_ !== 'errored' && !this.viewEndEmitted_ && this.currentPlaybackId_) {
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
        if (!this.viewEndEmitted_ && this.currentPlaybackId_) {
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

  openView(playbackId: string): void {
    this.currentPlaybackId_ = playbackId;
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

  getCurrentPlaybackId(): string | null {
    return this.currentPlaybackId_;
  }


  isPlaying(): boolean {
    return this.phase_ === 'playing' && !this.viewEndEmitted_;
  }
}
