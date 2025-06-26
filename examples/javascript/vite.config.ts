import path from 'path';
import { defineConfig } from 'vite';

// IMPORTANT: Replace 'your-repo-name' with the actual name of your GitHub repository.
const REPO_NAME = 'imagekit-video-player'; 

export default defineConfig({
  // The root of the vite project is the current directory.
  root: '.',
  // --- CHANGE 1: Set the base path for deployment ---
  base: `/${REPO_NAME}/`,

  server: {
    port: 3000,
  },
  build: {
    // --- CHANGE 2: Define the output directory ---
    outDir: './dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        shoppable: path.resolve(__dirname, 'pages/shoppable.html'),
        playlist: path.resolve(__dirname, 'pages/playlist.html'),
        recommendations: path.resolve(__dirname, 'pages/recommendations.html'),
        floatingWindow: path.resolve(__dirname, 'pages/floating-window.html'),
        chapters: path.resolve(__dirname, 'pages/chapters.html'),
        subtitles: path.resolve(__dirname, 'pages/subtitles.html'),
        seekThumbnails: path.resolve(__dirname, 'pages/seek-thumbnails.html'),
        // Note: You didn't provide a context-menu example, so it's commented out.
        // contextMenu: path.resolve(__dirname, 'pages/context-menu.html'),
      },
    },
  },
  resolve: {
    // This alias is likely not needed if your workspaces are set up correctly,
    // but we can leave it as it doesn't cause harm.
    alias: {
      '@imagekit/video-player': path.resolve(__dirname, '../../packages/video-player'),
    },
  },
});