import { defineConfig } from 'vite';
import path from 'path';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: '.',
  server: {
    port: 3001,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
  resolve: {
    alias: {
      '@imagekit/video-player/react': path.resolve(__dirname, '../../packages/video-player/dist/react'),
      '@imagekit/video-player': path.resolve(__dirname, '../../packages/video-player'),
    }
  },
});