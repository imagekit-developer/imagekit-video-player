/**
 * Strict playback/session/view state machine for analytics.
 * Prevents invalid or duplicate events; computes timing and ordering.
 */
import type {
  IKAnalyticsEventName,
  ViewEndReason,
  InternalAnalyticsEvent,
} from './types';

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
  | { type: 'playing_after_waiting' }
  | { type: 'ended' }
  | { type: 'error'; errorCode: string; errorMessage?: string; errorContext?: string }
  | { type: 'report_error'; errorCode: string; errorMessage?: string; errorContext?: string }
  | { type: 'dispose' }
  | { type: 'page_hide' }
  | { type: 'visibility_hidden' };

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
  onPlayerReady: (playerStartupTimeMs: number, pageLoadTimeMs?: number) => void;
  onViewInit: (playbackId: string) => void;
  onViewStarted: (videoStartupTimeMs: number) => void;
  onVideoChange: (playbackId: string) => void;
  onViewEnd: (reason: ViewEndReason) => void;
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
  private rebufferStartMonotonic_ = 0;
  private seekOpen_ = false;
  private seekStartMonotonic_ = 0;
  private seekFromPositionMs_ = 0;
  private phaseBeforeSeek_: PlaybackPhase | null = null;
  private playStartMonotonic_ = 0; // for video startup time
  private lastEventMonotonic_ = 0;
  private lastEventName_: IKAnalyticsEventName | null = null;
  private eventOrder_ = 0;
  private generateEventId_: () => string;

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
    generateEventId: () => string
  ) {
    this.callbacks_ = callbacks;
    this.generateEventId_ = generateEventId;
  }

  dispatch(signal: AnalyticsSignal, captureContext?: () => Partial<InternalAnalyticsEvent>): void {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
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
        ms_from_previous_event: msFromPrev,
        ...linkStamp,
        ...ctx,
        ...payload,
      } as InternalAnalyticsEvent);
      this.lastEventMonotonic_ = now;
      this.lastEventName_ = event;
    };

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
          emit('viewend', { view_end_reason: 'sessionrotate' });
          this.callbacks_.onViewEnd('sessionrotate');
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
        this.callbacks_.onPlayerReady(signal.playerStartupTimeMs, signal.pageLoadTimeMs);
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
            emit('viewend', { view_end_reason: 'videochange', video_source_url: signal.previousVideoSourceUrl });
            this.callbacks_.onViewEnd('videochange');
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
        emit('viewinit', { video_source_url: signal.videoSourceUrl });
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
        if (this.phase_ === 'buffering') {
          const rebufferDuration = Math.round(now - this.rebufferStartMonotonic_);
          this.rebufferOpen_ = false;
          emit('rebufferend', { rebuffer_duration_ms: rebufferDuration });
        }
        if (!this.hasEmittedViewStarted_) {
          this.hasEmittedViewStarted_ = true;
          if (this.previousSessionId_) {
            // Warm resume: omit video_startup_time_ms (server MV gates it on previous_session_id = '').
            this.callbacks_.onViewStarted?.(0);
            emit('viewstarted', {});
          } else {
            const videoStartupMs = Math.round(now - this.playStartMonotonic_);
            this.callbacks_.onViewStarted?.(videoStartupMs);
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
        emit('pause', ctx);
        this.phase_ = 'paused';
        return;

      case 'timeupdate':
        if (this.phase_ !== 'playing') return;
        emit('timeupdate', {
          playback_time_instant_ms: signal.playbackTimeMs,
          playing_time_ms: signal.playingTimeMs,
          played_delta_ms: signal.playedDeltaMs,
          bitrate: signal.bitrate,
          ...ctx,
        });
        return;

      case 'seeking':
        if (this.phase_ === 'disposed') return;
        if (this.phase_ === 'seeking') return; // dedupe continuous drag
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
        this.phase_ = prior === 'paused' ? 'paused' : 'playing';
        return;
      }

      case 'waiting':
        // Only mid-play stalls count as rebuffer; initial/resume buffering is video startup.
        if (!this.hasEmittedViewStarted_) return;
        if (this.phase_ !== 'playing') return;
        if (this.seekOpen_) return; // do not treat seek as rebuffer
        if (this.rebufferOpen_) return;
        this.rebufferOpen_ = true;
        this.rebufferStartMonotonic_ = now;
        emit('rebufferstart', ctx);
        this.phase_ = 'buffering';
        return;

      case 'playing_after_waiting':
        // Same as 'playing' - will close rebuffer if open
        this.dispatch({ type: 'playing' }, captureContext);
        return;

      case 'ended':
        if (this.phase_ === 'ended' || this.phase_ === 'disposed') return;
        // 'ended' does not close the view; looping/seeking back replays on the same view.
        emit('ended', ctx);
        this.phase_ = 'ended';
        return;

      case 'error':
        if (this.phase_ === 'disposed' || this.phase_ === 'errored') return;
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
          this.callbacks_.onViewEnd('error');
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
          emit('viewend', { view_end_reason: 'dispose' });
          this.viewEndEmitted_ = true;
          this.callbacks_.onViewEnd('dispose');
        }
        this.phase_ = 'disposed';
        return;

      case 'page_hide':
        // Tab close / navigation away. pagehide is the last reliable point to emit a
        // viewend; video.js 'dispose' does not fire before the page is torn down.
        if (this.phase_ === 'disposed' || this.phase_ === 'errored') return;
        if (!this.viewEndEmitted_ && this.currentPlaybackId_) {
          emit('viewend', { view_end_reason: 'navigation' });
          this.viewEndEmitted_ = true;
          this.callbacks_.onViewEnd('navigation');
        }
        return;

      case 'visibility_hidden':
        // Tracker handles flush; state machine doesn't emit for this
        return;
    }
  }

  openView(playbackId: string): void {
    this.currentPlaybackId_ = playbackId;
    this.phase_ = 'view_open';
    this.hasEmittedViewStarted_ = false;
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

  getEventOrder(): number {
    return this.eventOrder_;
  }

  getLastEventName(): IKAnalyticsEventName | null {
    return this.lastEventName_;
  }
}
