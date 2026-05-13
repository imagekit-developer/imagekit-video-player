import { defineConfig } from "tsup";
import { rmSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

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
    clean: true, // Clean the entire dist folder once
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

  // ─── Config 2: Astro DTS-only bundle ────────────────────────────────────────
  //
  // The Astro component ships as a source `.astro` file (resolved at runtime
  // via the package `exports` map's `default` condition). All we need from
  // tsup here is a single bundled `.d.ts` so TypeScript can resolve types
  // when a consumer imports from `@imagekit/video-player/astro`.
  //
  // Using tsup (vs plain tsc) means rollup-plugin-dts BUNDLES the
  // re-exported types from `'../javascript'` inline into one file — exactly
  // like React/Vue types are bundled. No `dist/javascript/` side effect,
  // no path rewriting, no separate tsconfig.
  //
  // tsup always emits JS alongside DTS; we delete the three tiny JS files
  // in `onSuccess` because nothing should ever import them at runtime.
  {
    entry: { 'astro/index': 'astro/index.ts' },
    outDir: 'dist',
    format: ["esm"],
    dts: true,
    sourcemap: false,
    treeshake: true,
    minify: false,
    splitting: false,
    clean: false, // Do NOT wipe dist — Config 1 has already populated it
    loader: { ".css": "empty", ".astro": "empty" },
    external: [/\.css$/, /\.astro$/],
    onSuccess: async () => {
      // tsup emits JS alongside DTS; delete it since only .d.ts is needed
      rmSync(resolve(__dirname, 'dist/astro/index.mjs'), { force: true });
      console.log('[astro-types] Removed JS artefact from dist/astro/ — .d.ts only.');
    },
  },
]);