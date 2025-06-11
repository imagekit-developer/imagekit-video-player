// packages/video-player/vue/IKVideoPlayer.ts
import { h, ref, watch, onUnmounted, computed, defineComponent, type PropType } from 'vue';
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
    className: { type: String },
    style: { type: Object as PropType<Record<string, any>> },
  },

  // 2. The setup function contains all your logic (hooks, etc.)
  setup(props, { expose }) {
    const videoElement = ref<HTMLVideoElement | null>(null);
    let player: Player | null = null;

    const playerClass = computed(() => `video-js ${props.className || ''}`);

    watch(
      [() => props.ikOptions, () => props.videoJsOptions],
      ([newIkOptions, newVideoJsOptions]) => {
        if (!videoElement.value) return;
        if (player) player.dispose();

        player = videoPlayer(videoElement.value, newIkOptions, newVideoJsOptions);

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
      },
      { immediate: true, deep: true }
    );

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
    });
  },
});