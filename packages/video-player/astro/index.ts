// astro/index.ts
//
// Type-only entry point for the Astro wrapper.
//
// This file exists ONLY so TypeScript can resolve
//   `import IKVideoPlayer, { type IKPlayerOptions, ... } from '@imagekit/video-player/astro'`
// correctly in user code.
//
// At runtime, the package `exports` map resolves `./astro` to the
// `.astro` source file at `./dist/astro/IKVideoPlayer.astro` via the
// `default` condition. The Astro/Vite consumer then compiles it.
//
// tsup bundles this entry's DTS via rollup-plugin-dts; the emitted
// `dist/astro/index.d.ts` references `./IKVideoPlayer.astro`, which
// is the copied .astro file (placed there by `build:assets`).

// Re-export the *type* of the Astro component as the default export.
//
// Path note: this source path looks "wrong" — `./astro/IKVideoPlayer.astro`
// from inside the `astro/` folder would resolve to
// `astro/astro/IKVideoPlayer.astro` (no such file). It works because:
//
//   1. At authoring time, the ambient `declare module '*.astro'` in
//      `astro.d.ts` accepts any string ending in `.astro` regardless
//      of whether the file exists on disk — TS doesn't error.
//   2. At build time, tsup/rollup-plugin-dts recomputes the path
//      relative to the OUTPUT file (`dist/astro/index.d.ts`), emitting
//      `from './IKVideoPlayer.astro'` — which resolves to
//      `dist/astro/IKVideoPlayer.astro` (placed there by `build:assets`).
//
// Don't "fix" this back to `./IKVideoPlayer.astro` — that would emit a
// path resolving to `dist/IKVideoPlayer.astro` (missing) and silently
// break the published types.
export type { default } from './astro/IKVideoPlayer.astro';

// Re-export shared types so consumers can import everything from a
// single subpath, mirroring the React/Vue wrappers.
export type {
  IKPlayerOptions,
  SourceOptions,
  PlaylistOptions,
  Player,
} from '../javascript';
