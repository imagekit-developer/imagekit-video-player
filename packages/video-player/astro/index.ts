// astro/index.ts
//
// Runtime + types entry for the Astro wrapper.
//
// Build pipeline (see tsup.config.ts Config 2 + package.json `build:assets`):
//
//   1. tsup compiles this file to `dist/astro/index.mjs` with `.astro`
//      imports marked external (`external: [/\.astro$/]`), so the emit is
//      literally:
//
//        export { default as IKVideoPlayer } from './IKVideoPlayer.astro';
//
//   2. rollup-plugin-dts emits `dist/astro/index.d.mts`, inlining the
//      re-exported types from `'../javascript'` into a single bundled file
//      — same approach as the React/Vue wrappers.
//
//   3. `build:assets` copies `astro/IKVideoPlayer.astro` next to the emitted
//      JS at `dist/astro/IKVideoPlayer.astro`, so the relative import in
//      `index.mjs` resolves at consume time.
//
// At consume time, the package.json `./astro` export resolves to
// `dist/astro/index.mjs`. The consumer's Astro/Vite toolchain processes the
// `.astro` file referenced by the relative import. This exposes
// `IKVideoPlayer` as a NAMED export, matching the React/Vue wrappers:
//
//   import { IKVideoPlayer } from '@imagekit/video-player/astro';

export { default as IKVideoPlayer } from './IKVideoPlayer.astro';

export type {
  IKPlayerOptions,
  SourceOptions,
  PlaylistOptions,
  Player,
} from '../javascript';

