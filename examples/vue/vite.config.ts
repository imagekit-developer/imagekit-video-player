import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@imagekit/video-player/vue': path.resolve(__dirname, '../../packages/video-player/dist/vue'),
      '@imagekit/video-player': path.resolve(__dirname, '../../packages/video-player'),
    }
  },
})
