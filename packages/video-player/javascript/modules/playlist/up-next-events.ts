/**
 * Player events the auto-advance countdown fires, so other end-of-video overlays
 * (recommendations, shoppable post-play) can wait for it instead of covering it.
 */
export const UP_NEXT_EVENTS = {
  /** A visible countdown to the next playlist item started. */
  START: 'upnextstart',
  /** The countdown is over: advanced, cancelled or reset. */
  END: 'upnextend',
  /** The viewer cancelled the countdown (Cancel button or Escape). */
  CANCEL: 'upnextcancel',
} as const;
