// packages/video-player/vue/IKVideoPlayer.ts
import { h, ref, watch, onUnmounted, computed, defineComponent, type PropType, onMounted } from 'vue';
import { videoPlayer } from '../javascript';
import type { PlayerOptions, SourceOptions, PlaylistOptions } from '../javascript';
import type Player from 'video.js/dist/types/player';

export const IKVideoPlayer = defineComponent({
  // 1. Props are defined in the component configuration
  props: {
    ikOptions: { type: Object as PropType<PlayerOptions>, required: true },
    videoJsOptions: { type: Object, default: () => ({}) },
    source: { type: Object as PropType<SourceOptions> },
    playlist: { type: Object as PropType<{ sources: SourceOptions[]; options?: PlaylistOptions }> },
  },

  // 2. The setup function contains all your logic (hooks, etc.)
  setup(props, { expose }) {
    const videoElement = ref<HTMLVideoElement | null>(null);
    let player: Player | null = null;

    const playerClass = computed(() => 'video-js');

    const initializePlayer = () => {
      // Guard against cases where the element might not be ready
      if (!videoElement.value) return;

      // Dispose of any existing player instance to prevent memory leaks
      if (player) {
        player.dispose();
      }

      console.log('[IKVideoPlayer] Creating new video player instance');
      player = videoPlayer(videoElement.value, props.ikOptions, props.videoJsOptions);

      // Expose the player instance to the parent component
      expose({
        getPlayer: (): Player | null => player,
      });

      // Handle playlist or single source
      if (props.source && props.playlist) {
        console.warn('[IKVideoPlayer] Both `source` and `playlist` were provided. Using `playlist`.');
      }

      if (props.playlist?.sources.length) {
        const playlistMgr = (player as any).playlist({
          sources: props.playlist.sources,
          options: props.playlist.options || {},
        });
        playlistMgr.loadFirstItem();
      } else if (props.source) {
        player.src(props.source);
      }
    };
    // 1. Initialize the player AFTER the component is mounted to the DOM
    onMounted(() => {
      initializePlayer();
    });

    // 2. Watch for changes in options and re-initialize if necessary
    watch(
      [() => props.ikOptions, () => props.videoJsOptions],
      () => {
        // The player is already mounted, so we can re-initialize
        initializePlayer();
      },
      { deep: true } // No 'immediate' needed here
    );

    // 3. Clean up when the component is unmounted
    onUnmounted(() => {
      if (player) {
        player.dispose();
        player = null;
      }
    });


    // Expose the getPlayer method to parent components
    expose({
      getPlayer: (): Player | null => player,
    });

    // Return the necessary refs and computed properties to the render function
    return {
      videoElement,
      playerClass,
    };
  },

  // 3. The render function creates the HTML structure
  render() {
    // h(tag, { props/attributes }, [children])
    return h('video', {
      ref: 'videoElement', // Vue will link this string ref to the ref of the same name from setup()
      class: this.playerClass,
      style: this.style,
      controls: true,
      preload: 'auto',
      height: "540px",
      width: "960px",
    });
  },
});