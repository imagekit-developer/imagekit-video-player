export function randomId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function createPlayerInstanceId(): string {
  return randomId();
}

/** One per view. */
export function createPlaybackId(): string {
  return randomId();
}

export function createEventId(): string {
  return randomId();
}
