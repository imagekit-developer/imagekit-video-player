// astro/index.ts
// Re-export the Astro component as the default export
export { default as IKVideoPlayer } from './IKVideoPlayer.astro';

// Re-export all types from the main package for convenience
export type {
  IKPlayerOptions,
  SourceOptions,
  PlaylistOptions,
  Player,
} from '../javascript';
