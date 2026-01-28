import { videoPlayer } from '@imagekit/video-player';
import '@imagekit/video-player/styles.css';
import { buildPlayerInitCode, formatObjectAsCode } from './codegen';

// --- Actual Player Initialization (single source of truth) ---
const playerOptions = {
  imagekitId: 'zuqlyov9d', // Replace with your ImageKit ID
  seekThumbnails: true,
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
  src: 'https://stage-ik.imagekit.io/a8fli6vdg/New%20Folder33/JackMa_RuBbxVpuX.mp4?updatedAt=1762764326271&version=yashtest3&ik=debug=true',
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