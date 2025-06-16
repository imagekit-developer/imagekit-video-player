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
import { ref } from 'vue';
// Import your component and types
import { IKVideoPlayer } from '@imagekit/video-player/vue';
import type { PlayerOptions, SourceOptions, PlaylistOptions } from '@imagekit/video-player';

// Create a ref to get access to the component's exposed methods
import type { IKVideoPlayerRef } from '@imagekit/video-player/vue';

const playerRef = ref<IKVideoPlayerRef | null>(null);

const ikOptions: PlayerOptions = {
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
</script>

<style>
/* Global import for video-js styles */
@import '@imagekit/video-player/styles.css';
</style>