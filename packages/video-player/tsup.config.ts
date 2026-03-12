import { defineConfig } from "tsup";

export default defineConfig({
  // Define entry points. The key is the output path relative to outDir.
  entry: {
    // This will generate `dist/index.{js,mjs,d.ts}`
    'index': 'javascript/index.ts',
    // This will generate `dist/react/index.{js,mjs,d.ts}`
    'react/index': 'react-wrapper/index.ts',
    'vue/index': 'vue/index.ts'
  },
  // The single output directory
  outDir: 'dist',
  format: ["esm", "cjs", "iife"],
  globalName: "ImageKitVideoPlayer",
  // Generate DTS files for all entry points
  dts: true,
  // Disable sourcemaps by default for smaller builds (can be enabled with --sourcemap flag)
  // Sourcemaps add ~13MB to the build output
  sourcemap: false,
  // Enable tree shaking to remove unused code
  treeshake: true,
  // Enable minification for smaller bundle sizes
  minify: true,
  // Disable code splitting for simplicity (keeps single-file outputs)
  splitting: false,
  clean: true, // Clean the entire dist folder once
  // This onSuccess script will run after all builds are complete
  onSuccess: "npm run build:css",
  // Loaders apply to all entry points
  loader: {
    // This tells tsup to not bundle CSS, but reference it as a file.
    // However, since you are manually handling CSS with SASS,
    // it's better to tell esbuild to just ignore it.
    ".css": "empty",
    ".tsx": "tsx",
  },
  external: [
    /\.css$/],
});