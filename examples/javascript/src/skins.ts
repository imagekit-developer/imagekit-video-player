import { videoPlayer } from '@imagekit/video-player';
import '@imagekit/video-player/styles.css';
import { formatObjectAsCode } from './codegen';

// --- Actual Player Initialization (single source of truth) ---
const playerOptions = {
  imagekitId: 'imagekit_id', // Replace with your ImageKit ID
  seekThumbnails: true,
  logo: {
    showLogo: true,
    logoImageUrl: 'https://imagekit.io/icons/icon-144x144.png',
    logoOnclickUrl: 'https://imagekit.io/',
  },
};

const videoJsOptions = {
  muted: true,
  playbackRates: [0.5, 1, 1.5, 2],
};

const PLAYLIST = 'https://ik.imagekit.io/ikmedia/docs/video-player/playlist/';
const SHOPPABLE = 'https://ik.imagekit.io/ikmedia/docs/video-player/shoppable/';

// One playlist that exercises every feature, loaded into both players.
const playlistConfig = {
  sources: [
    {
      src: `${SHOPPABLE}video.mp4`,
      info: { title: 'Shoppable video', description: 'Product panel, hotspots and post-play screen' },
      shoppable: {
        products: [
          {
            productId: 1,
            productName: 'Classic Aviators',
            highlightTime: { start: 2, end: 6 },
            imageUrl: `${SHOPPABLE}aviators.jpeg`,
            hotspots: [{ time: '00:06', x: '48%', y: '35%', tooltipPosition: 'left' as const, clickUrl: 'https://imagekit.io/' }],
            onHover: { action: 'overlay' as const, args: 'Click to see this product in the video' },
            onClick: { action: 'seek' as const, pause: 5, args: { time: '00:06' } },
          },
          {
            productId: 2,
            productName: 'Wooden frame glasses',
            imageUrl: `${SHOPPABLE}wooden_frames.jpeg`,
            onClick: { action: 'goto' as const, pause: true, args: { url: 'https://www.pexels.com/search/wooden%20glasses%20frames/' } },
          },
          {
            productId: 3,
            productName: 'Sunglasses',
            imageUrl: `${SHOPPABLE}sunglass.jpeg`,
            onHover: { action: 'overlay' as const, args: 'Click to go to website' },
            onClick: { action: 'goto' as const, pause: true, args: { url: 'https://www.pexels.com/search/sunglasses/' } },
          },
        ],
        showPostPlayOverlay: true,
        autoClose: false as const,
        startState: 'open' as const,
      },
    },
    {
      src: 'https://ik.imagekit.io/ikmedia/docs/video-player/subtitle_chapter/demo.mp4',
      info: { title: 'Chapters and subtitles', description: 'Chapter markers and auto-generated captions' },
      chapters: { 0: 'Introduction', 146: 'Main Content', 302: 'Advanced Topics', 443: 'Q&A Session', 563: 'Conclusion' },
      textTracks: [{ autoGenerate: true as const, default: true }],
    },
    {
      src: `${PLAYLIST}horses.mp4`,
      info: { title: 'Horses Running', description: 'Shows recommendations when it ends' },
      recommendations: [
        { src: `${PLAYLIST}lion.mp4`, info: { title: 'Lion' } },
        { src: `${PLAYLIST}dog_running.mp4`, info: { title: 'Dog Running' } },
        { src: `${PLAYLIST}man_smiling.mp4`, info: { title: 'Man Smiling' } },
        { src: `${PLAYLIST}rhino.mp4`, info: { title: 'Rhino at the zoo' } },
      ],
    },
    { src: `${PLAYLIST}lion.mp4`, info: { title: 'Lion', description: 'Lion roaming in the wild' } },
    { src: `${PLAYLIST}dog_running.mp4`, info: { title: 'Dog Running' } },
  ],
  options: {
    autoAdvance: 5,
    repeat: true,
    presentUpcoming: 10,
    widgetProps: { direction: 'vertical' as const },
  },
};

const codeToDisplay = `// HTML: <video id="player" class="video-js video-js-skin-light" ...></video>
// (drop "video-js-skin-light" for the dark skin)

import { videoPlayer } from '@imagekit/video-player';
import '@imagekit/video-player/styles.css';

const player = videoPlayer('player', ${formatObjectAsCode(playerOptions)}, ${formatObjectAsCode(videoJsOptions)});
const playlistManager = player.playlist(${formatObjectAsCode(playlistConfig)});
playlistManager.loadFirstItem();

// Dark playlist panel (there is no option for it yet):
// player.el().closest('.ik-player-container')?.classList.add('theme-dark');`;

document.getElementById('code-display')!.textContent = codeToDisplay.trim();

for (const id of ['player-dark', 'player-light']) {
  const player = videoPlayer(id, playerOptions, videoJsOptions);
  const playlistManager = player.playlist(playlistConfig);
  playlistManager.loadFirstItem();
  if (id === 'player-dark') {
    // The playlist panel has its own light/dark theme, set with a class.
    player.el().closest('.ik-player-container')?.classList.add('theme-dark');
  }
}
