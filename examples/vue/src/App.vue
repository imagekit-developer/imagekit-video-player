<template>
  <div class="container">
    <h1>ImageKit Video Player (Vue) Example</h1>

    <button @click="logCurrentTime">
      Log current time & ensure player is playing
    </button>

    <div class="player-container">
      <IKVideoPlayer
        ref="playerRef"
        :ikOptions="ikOptions"
        :videoJsOptions="{
          controls: true,
          fluid: true,
          muted: false,
        }"
        :playlist="playlist"
        class-name="my-custom-player-container"
        :style="{ width: '100%' }"
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
const playerRef = ref<InstanceType<typeof IKVideoPlayer> | null>(null);

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
  options: { autoAdvance: true },
};

const logCurrentTime = () => {
  const player = playerRef.value?.getPlayer();
  if (player) {
    console.log('Current time:', player.currentTime());
    player.play();
  }
};
</script>

<style scoped>
.container {
  max-width: 800px;
  margin: 2rem auto;
  font-family: sans-serif;
}
.player-container {
  margin-top: 1rem;
  border: 1px solid #ccc;
}
button {
  padding: 8px 16px;
  cursor: pointer;
}
</style>

<style>
/* Global import for video-js styles */
@import '@imagekit/video-player/styles.css';
</style>