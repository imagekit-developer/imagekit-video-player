import { videoPlayer } from '@imagekit/video-player';
import '@imagekit/video-player/styles.css';
import { formatObjectAsCode } from './codegen';

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

const srcConfigDash = {
  src: 'https://ik.imagekit.io/demo/sample-video.mp4',
  abs: {
    protocol: 'dash',
    sr: [240, 360, 720, 1080],
  },
};

const srcConfigHls = {
  src: 'https://ik.imagekit.io/demo/sample-video.mp4',
  abs: {
    protocol: 'hls',
    sr: [240, 360, 720, 1080],
  },
};

const codeToDisplay = `// HTML: <div id="player-container"></div>

import { videoPlayer } from '@imagekit/video-player';
import '@imagekit/video-player/styles.css';

const player = videoPlayer('player', ${formatObjectAsCode(playerOptions)}, ${formatObjectAsCode(videoJsOptions)});
player.src(${formatObjectAsCode(srcConfigDash)});

const player2 = videoPlayer('player-2', ${formatObjectAsCode(playerOptions)}, ${formatObjectAsCode(videoJsOptions)});
player2.src(${formatObjectAsCode(srcConfigHls)});`;

// Mount the code to the display block
document.getElementById('code-display')!.textContent = codeToDisplay.trim();

const player = videoPlayer('player', playerOptions, videoJsOptions);
player.src(srcConfigDash);

const player2 = videoPlayer('player-2', playerOptions, videoJsOptions);
player2.src(srcConfigHls);
