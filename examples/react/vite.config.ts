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
      // This creates a direct alias to your package's root
      '@imagekit/video-player': path.resolve(__dirname, '../../packages'),
    },
  },
});