import { videoPlayer } from '@imagekit/video-player';
import '@imagekit/video-player/styles.css';
import { buildPlayerInitCode, formatObjectAsCode } from './codegen';

// --- Actual Player Initialization (single source of truth) ---
const playerOptions = {
  imagekitId: 'imagekit_id', // Replace with your ImageKit ID
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
  src: "https://ik.imagekit.io/ikmedia/docs/video-player/playlist/horses.mp4",
  info: { title: "Horses Running", description: "Horses grazing in the field" },
  recommendations: [
    {
      src: "https://ik.imagekit.io/ikmedia/docs/video-player/playlist/lion.mp4",
      info: {
        title: "Lion",
        description: "Lion roaming in the wild",
      },
    },
    {
      src: "https://ik.imagekit.io/ikmedia/docs/video-player/playlist/dog_running.mp4",
      info: { title: "Dog Running" },
    },
    {
      src: "https://ik.imagekit.io/ikmedia/docs/video-player/playlist/man_smiling.mp4",
      info: {
        title: "Man Smiling",
        description: "Man smiling at the camera",
      },
    },
    {
      src: "https://ik.imagekit.io/ikmedia/docs/video-player/playlist/rhino.mp4",
      info: { title: "Rhino at the zoo" },
    },
    {
      src: "https://ik.imagekit.io/demo/sample-video.mp4",
      info: { title: "Bird on branch"}
    }
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