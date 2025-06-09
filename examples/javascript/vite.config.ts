import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  server: {
    port: 3000
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
  resolve: {
    alias: {
      // This creates a direct alias to your package's root
      '@imagekit/video-player': path.resolve(__dirname, '../../packages'),
    },
  },
});
