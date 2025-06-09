import { defineConfig } from "tsup";

export default defineConfig({
  // Define entry points. The key is the output path relative to outDir.
  entry: {
    // This will generate `dist/index.{js,mjs,d.ts}`
    'index': 'javascript/index.ts',
    // This will generate `dist/react/index.{js,mjs,d.ts}`
    'react/index': 'react-wrapper/index.ts',
  },
  // The single output directory
  outDir: 'dist',
  format: ["esm", "cjs"],
  // Generate DTS files for all entry points
  dts: true,
  sourcemap: true,
  // @todo: Remove splitting and treeshake options if not needed
  splitting: false, // Disable code splitting for simplicity
  treeshake: false,
  clean: true, // Clean the entire dist folder once
  // This onSuccess script will run after all builds are complete
  onSuccess: "npm run build-css",
  // Loaders apply to all entry points
  loader: {
    // This tells tsup to not bundle CSS, but reference it as a file.
    // However, since you are manually handling CSS with SASS,
    // it's better to tell esbuild to just ignore it.
    ".css": "empty",
    ".tsx": "tsx",
  },
  // We handle the main CSS file with the sass script, so we don't want
  // tsup to bundle any other CSS imports.
  external: [/\.css$/],
});