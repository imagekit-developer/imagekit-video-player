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

const srcConfig = {
  src: 'https://stage-ik.imagekit.io/a8fli6vdg/New%20Folder33/JackMa_RuBbxVpuX.mp4?updatedAt=1762764326271&version=yashtest3&ik=debug=true',
  chapters: true,
};

const codeToDisplay = buildPlayerInitCode({
  htmlHint: '<video id="player" class="video-js" ...></video>',
  playerTarget: 'player',
  playerOptions,
  afterInitLines: [``, `player.src(${formatObjectAsCode(srcConfig)});`],
});

document.getElementById('code-display')!.textContent = codeToDisplay.trim();

const player = videoPlayer('player', playerOptions);
player.src(srcConfig);