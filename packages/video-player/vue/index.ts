export { IKVideoPlayer } from './IKVideoPlayer';

// Re-export all types from the main package (including Player)
export type * from '../javascript';

// Import Player type for the ref interface
import type { Player } from '../javascript';

/** Methods exposed via ref for the Vue IKVideoPlayer component */
export interface IKVideoPlayerRef {
  /** Returns the underlying Video.js player instance (or null if not yet mounted) */
  getPlayer: () => Player | null;
}
