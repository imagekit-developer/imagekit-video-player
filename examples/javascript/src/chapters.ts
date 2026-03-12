import { videoPlayer } from '@imagekit/video-player';
import type { SourceOptions } from '@imagekit/video-player';
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

const videoSrc = 'https://ik.imagekit.io/ikmedia/docs/video-player/subtitle_chapter/demo.mp4';
// Method 1: Auto-generate chapters (AI)
const srcConfigAuto = {
  src: videoSrc,
  chapters: true,
  textTracks: [
    {
      autoGenerate: true as const,
      translations: [
        {
          langCode: 'hi' as const,
          label: 'Hindi (AI)',
          default: true,
        },
        {
          langCode: 'de' as const,
          label: 'German (AI)',
        },
      ],
    }
  ],
};

// Method 2: Load from VTT URL
const srcConfigUrl = {
  src: videoSrc,
  chapters: {
    url: 'https://ik.imagekit.io/ikmedia/docs/video-player/subtitle_chapter/demo.vtt', // Replace with your VTT file URL
  },
};

// Method 3: Manual chapter object
const srcConfigManual = {
  src: videoSrc,
  chapters: {
    0: 'Introduction',
    146: 'Main Content',
    302: 'Advanced Topics',
    443: 'Q&A Session',
    563: 'Conclusion'
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