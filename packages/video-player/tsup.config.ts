import { defineConfig } from "tsup";
import { rmSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Wipe `dist/` once, BEFORE any config starts. We can't use tsup's per-config
// `clean: true` because the two configs below run in parallel — Config 1's
// `clean: true` would race against Config 2's emit and randomly delete
// `dist/astro/index.{mjs,d.mts}`.
rmSync(resolve(__dirname, 'dist'), { recursive: true, force: true });

export default defineConfig([
  // ─── Config 1: Main JS + DTS bundles (core, React, Vue) ────────────────────
  {
    entry: {
      // This will generate `dist/index.{js,mjs,d.ts}`
      'index': 'javascript/index.ts',
      // This will generate `dist/react/index.{js,mjs,d.ts}`
      'react/index': 'react-wrapper/index.ts',
      'vue/index': 'vue/index.ts',
    },
    outDir: 'dist',
    format: ["esm", "cjs", "iife"],
    globalName: "ImageKitVideoPlayer",
    // Generate DTS files for all entry points
    dts: true,
    // Disable sourcemaps by default for smaller builds (can be enabled with --sourcemap flag)
    sourcemap: false,
    // Enable tree shaking to remove unused code
    treeshake: true,
    // Enable minification for smaller bundle sizes
    minify: true,
    // Disable code splitting for simplicity (keeps single-file outputs)
    splitting: false,
    clean: false, // Cleanup happens once at the top of this file
    // This onSuccess script will run after this config completes
    onSuccess: "npm run build:css",
    loader: {
      // This tells esbuild to not bundle CSS, but reference it as a file.
      ".css": "empty",
      ".tsx": "tsx",
      ".astro": "empty",
    },
    external: [/\.css$/, /\.astro$/],
  },

  // ─── Config 2: Astro entry (JS re-export + DTS) ──────────────────────────
  //
  // `astro/index.ts` re-exports the default export of `IKVideoPlayer.astro`
  // as a NAMED `IKVideoPlayer`. With `.astro` marked external, tsup emits a
  // tiny `dist/astro/index.mjs` containing literally:
  //
  //   export { default as IKVideoPlayer } from './IKVideoPlayer.astro';
  //
  // The consumer's Astro/Vite toolchain resolves that relative `.astro`
  // import against the copy placed at `dist/astro/IKVideoPlayer.astro` by
  // `build:assets`, and processes it. This gives consumers a named-import
  // API (`import { IKVideoPlayer } from '@imagekit/video-player/astro'`)
  // that matches the React/Vue wrappers.
  //
  // rollup-plugin-dts BUNDLES the re-exported types from `'../javascript'`
  // inline into a single `.d.ts` — same as React/Vue.
  {
    entry: { 'astro/index': 'astro/index.ts' },
    outDir: 'dist',
    format: ["esm", "cjs", "iife"],
    dts: true,
    sourcemap: false,
    treeshake: true,
    minify: false,
    splitting: false,
    clean: false, // Do NOT wipe dist — Config 1 has already populated it
    loader: { ".css": "empty", ".astro": "empty" },
    external: [/\.css$/, /\.astro$/],
  },
]);