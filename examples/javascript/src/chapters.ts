import { videoPlayer } from '@imagekit/video-player';
import type { SourceOptions } from '@imagekit/video-player';
import '@imagekit/video-player/styles.css';
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

const videoSrc = 'https://stage-ik.imagekit.io/a8fli6vdg/New%20Folder33/JackMa_RuBbxVpuX.mp4?updatedAt=1762764326271&version=yashtest3&ik=debug=true';

// Method 1: Auto-generate chapters (AI)
const srcConfigAuto = {
  src: videoSrc,
  chapters: true,
};

// Method 2: Load from VTT URL
const srcConfigUrl = {
  src: videoSrc,
  chapters: {
    url: 'https://ik.imagekit.io/zuqlyov9d/chapters.vtt', // Replace with your VTT file URL
  },
};

// Method 3: Manual chapter object
const srcConfigManual = {
  src: videoSrc,
  chapters: {
    0: 'Introduction',
    20: 'Main Content',
    30: 'Key Points',
    60: 'Conclusion',
  },
};

let currentSrcConfig: SourceOptions = srcConfigAuto;

function updateCodeDisplay() {
  const codeToDisplay = buildPlayerInitCode({
    htmlHint: '<video id="player" class="video-js" ...></video>',
    playerTarget: 'player',
    playerOptions,
    videoJsOptions,
    afterInitLines: [``, `player.src(${formatObjectAsCode(currentSrcConfig)});`],
  });
  document.getElementById('code-display')!.textContent = codeToDisplay.trim();
}

// Tab switching logic
const tabButtons = document.querySelectorAll('.tab-button');
tabButtons.forEach((button) => {
  button.addEventListener('click', () => {
    // Remove active class from all buttons and tabs
    tabButtons.forEach((btn) => btn.classList.remove('active'));
    button.classList.add('active');

    const tabName = button.getAttribute('data-tab');
    
    // Update source config based on selected tab
    switch (tabName) {
      case 'auto':
        currentSrcConfig = srcConfigAuto;
        break;
      case 'url':
        currentSrcConfig = srcConfigUrl;
        break;
      case 'manual':
        currentSrcConfig = srcConfigManual;
        break;
    }

    // Update code display
    updateCodeDisplay();

    // Update player source
    player.src(currentSrcConfig);
  });
});

// Initial code display
updateCodeDisplay();

const player = videoPlayer('player', playerOptions, videoJsOptions);
player.src(currentSrcConfig);