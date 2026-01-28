<template>
  <div class="container">
    <h1>ImageKit Video Player (Vue) Example</h1>
    <div>
      <IKVideoPlayer
        ref="playerRef"
        :ikOptions="ikOptions"
        :videoJsOptions="{
          controls: true,
          muted: false,
          height: 540,
          width: 960,
        }"
        :playlist="playlist"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { IKVideoPlayer } from '@imagekit/video-player/vue';
import type { IKPlayerOptions, SourceOptions, PlaylistOptions, IKVideoPlayerRef } from '@imagekit/video-player/vue';

const playerRef = ref<IKVideoPlayerRef | null>(null);

const ikOptions: IKPlayerOptions = {
  imagekitId: 'YOUR_IMAGEKIT_ID', // Remember to replace this
  seekThumbnails: true,
};

const playlist: {
  sources: SourceOptions[];
  options?: PlaylistOptions;
} = {
  sources: [
    { src: 'https://ik.imagekit.io/zuqlyov9d/SEO-friendly%20file%20names.mp4' },
    { src: 'https://ik.imagekit.io/zuqlyov9d/sample-video.mp4' },
  ],
  options: { autoAdvance: 5 }, // Set autoAdvance to a valid number (e.g., 5 seconds)
};

// Example: Access the player instance and use it
onMounted(() => {
  // Wait a bit for the player to initialize
  setTimeout(() => {
    const player = playerRef.value?.getPlayer();
    if (player) {
      // Example: Listen to player events
      player.on('play', () => {
        console.log('Video started playing');
      });

      player.on('pause', () => {
        console.log('Video paused');
      });

      // Example: Access playlist manager (if playlist is already set via props)
      // Note: playlist() method requires options, so we access it via the plugin
      const plugin = player.imagekitVideoPlayer();
      if (plugin) {
        const playlistManager = plugin.getPlaylistManager();
        if (playlistManager) {
          console.log('Playlist manager available:', playlistManager);
        }
        
        const currentSource = plugin.getOriginalCurrentSource();
        console.log('Current source:', currentSource);
      }
    }
  }, 1000);
});
</script>

<style>
/* Global import for video-js styles */
@import '@imagekit/video-player/styles.css';
</style>