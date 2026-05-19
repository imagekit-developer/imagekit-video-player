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
  | { type: 'dispose' }
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
      this.callbacks_.onEvent({
        event,
        event_id: eventId,
        ms_from_previous_event: msFromPrev,
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
        if (signal.isVideoChange && this.currentPlaybackId_) {
          if (this.phase_ !== 'ended' && this.phase_ !== 'errored') {
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
        this.openView(signal.playbackId);
        emit('viewinit', { video_source_url: signal.videoSourceUrl });
        return;
      }
      case 'play':
        if (this.phase_ === 'ended' || this.phase_ === 'disposed' || this.phase_ === 'errored') return;
        if (this.phase_ === 'idle') return; // must have viewopen first
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
          const videoStartupMs = Math.round(now - this.playStartMonotonic_);
          this.callbacks_.onViewStarted?.(videoStartupMs);
          emit('viewstarted', { video_startup_time_ms: videoStartupMs });
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
        // Defense-in-depth against seek-induced pause events that slip past the adapter
        // (e.g. race between the browser's internal pause and the `seeking` event).
        if (this.phase_ === 'seeking') return;
        if (this.phase_ === 'paused') return; // de-dupe consecutive pause events
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
        if (this.phase_ === 'ended' || this.phase_ === 'disposed') return;
        // Dedupe: HTML5/Video.js can fire `seeking` many times per drag as currentTime
        // updates. Collapse a continuous seek into one row; only the first opens it.
        if (this.phase_ === 'seeking') return;
        // Remember whether the user was playing or paused before the seek so we can
        // restore it on `seeked` rather than always assuming `playing`.
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
        // Restore the pre-seek phase. If the user was paused before scrubbing, stay paused;
        // a subsequent `playing` will move us forward when playback actually resumes.
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
        emit('ended', ctx);
        this.phase_ = 'ended';
        emit('viewend', { view_end_reason: 'ended' });
        this.callbacks_.onViewEnd('ended');
        return;

      case 'error':
        emit('error', {
          error_code: signal.errorCode,
          error_message: signal.errorMessage,
          error_context: signal.errorContext,
          ...ctx,
        });
        if (this.phase_ !== 'ended' && this.phase_ !== 'disposed') {
          this.phase_ = 'errored';
          emit('viewend', { view_end_reason: 'error' });
          this.callbacks_.onViewEnd('error');
        }
        return;

      case 'dispose':
        if (this.phase_ === 'disposed') return;
        if (this.phase_ !== 'ended' && this.phase_ !== 'errored' && this.currentPlaybackId_) {
          emit('viewend', { view_end_reason: 'dispose' });
          this.callbacks_.onViewEnd('dispose');
        }
        this.phase_ = 'disposed';
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
    this.rebufferOpen_ = false;
    this.seekOpen_ = false;
    this.eventOrder_ = 0;
    this.lastEventName_ = null;
    this.lastEventMonotonic_ = 0;
  }

  openViewAfterVideoChange(playbackId: string): void {
    this.currentPlaybackId_ = playbackId;
    this.phase_ = 'view_open';
    this.hasEmittedViewStarted_ = false;
    this.rebufferOpen_ = false;
    this.seekOpen_ = false;
    this.eventOrder_ = 0;
    this.lastEventName_ = null;
    this.lastEventMonotonic_ = typeof performance !== 'undefined' ? performance.now() : Date.now();
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
