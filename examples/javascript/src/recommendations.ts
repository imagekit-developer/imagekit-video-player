import { videoPlayer } from '@imagekit/video-player';
import '@imagekit/video-player/dist/styles.css';
import { buildPlayerInitCode, formatObjectAsCode } from './codegen';

// --- Actual Player Initialization (single source of truth) ---
const playerOptions = {
  imagekitId: 'zuqlyov9d', // Replace with your ImageKit ID
  logo: {
    showLogo: true,
    logoImageUrl: 'https://imagekit.io/icons/icon-144x144.png',
    logoOnclickUrl: 'https://imagekit.io/',
  },
};

const videoJsOptions = {
  muted: true,
};

const srcConfig = {
  src: 'https://ik.imagekit.io/demo/sample-video.mp4',
  recommendations: [
    {
      src: 'https://ik.imagekit.io/zuqlyov9d/SEO-friendly%20file%20names.mp4',
      info: { title: 'Watch This Next!', subtitle: 'A great choice' },
    },
    {
      src: 'https://ik.imagekit.io/zuqlyov9d/example_video_2.mp4',
      info: { title: 'Or Maybe This One?', subtitle: 'Another option' },
    },
    {
      src: 'https://ik.imagekit.io/demo/sample-video.mp4',
      info: { title: 'Watch The First One Again', subtitle: 'A classic' },
    },
  ],
};

const codeToDisplay = buildPlayerInitCode({
  htmlHint: '<video id="player" class="video-js" ...></video>',
  playerTarget: 'player',
  playerOptions,
  videoJsOptions,
  afterInitLines: [``, `player.src(${formatObjectAsCode(srcConfig)});`],
});

document.getElementById('code-display')!.textContent = codeToDisplay.trim();

const player = videoPlayer('player', playerOptions, videoJsOptions);
player.src(srcConfig);