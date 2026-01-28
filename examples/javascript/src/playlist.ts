import { videoPlayer } from '@imagekit/video-player';
import '@imagekit/video-player/dist/styles.css';
import { formatObjectAsCode } from './codegen';

// --- Actual Player Initialization ---
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

const playlistConfig = {
  sources: [
    {
      src: 'https://ik.imagekit.io/demo/sample-video.mp4?tr=rt-180,so-2&v=1234',
      info: { title: 'Sample Video', subtitle: 'A subtitle for the video' },
      transformation: [
        {
          width: 1000,
          height: 500,
        },
      ],
    },
    {
      src: 'https://ik.imagekit.io/zuqlyov9d/SEO-friendly%20file%20names.mp4',
      info: { title: 'Another Video', subtitle: 'This one is different' },
    },
    {
      src: 'https://ik.imagekit.io/zuqlyov9d/example_video_2.mp4',
      info: { title: 'Third Time Is The Charm', subtitle: 'The final video' },
    },
    {
      src: 'https://ik.imagekit.io/demo/sample-video.mp4',
      info: { title: 'A very long name. It will not fit in the single line.', subtitle: 'Video 4' },
    },
    {
      src: 'https://ik.imagekit.io/zuqlyov9d/SEO-friendly%20file%20names.mp4',
      info: { title: 'Video 5', subtitle: 'Video 5' },
    },
    {
      src: 'https://ik.imagekit.io/zuqlyov9d/example_video_2.mp4',
      info: { title: 'Video 6', subtitle: 'Video 6' },
    },
  ],
  options: {
    autoAdvance: 3,
    repeat: true,
    presentUpcoming: 10,
    widgetProps: { direction: 'vertical' as const },
  },
};

const player2Options = {
  imagekitId: 'zuqlyov9d', // Replace with your ImageKit ID
  logo: {
    showLogo: true,
    logoImageUrl: 'https://imagekit.io/icons/icon-144x144.png',
    logoOnclickUrl: 'https://imagekit.io/',
  },
};

const playlistConfig2 = {
  ...playlistConfig,
  options: {
    ...playlistConfig.options,
    widgetProps: { direction: 'horizontal' as const },
  },
};

const codeToDisplay = `// HTML: <div id="player-container"></div>

import { videoPlayer } from '@imagekit/video-player';
import '@imagekit/video-player/dist/styles.css';

const player = videoPlayer('player', ${formatObjectAsCode(playerOptions)}, ${formatObjectAsCode(videoJsOptions)});
const playlistManager = player.playlist(${formatObjectAsCode(playlistConfig)});
playlistManager.loadFirstItem();

const player2 = videoPlayer('player-2', ${formatObjectAsCode(player2Options)});
const playlistManager2 = player2.playlist(${formatObjectAsCode(playlistConfig2)});
playlistManager2.loadFirstItem();`;

// Mount the code to the display block
document.getElementById('code-display')!.textContent = codeToDisplay.trim();

const player = videoPlayer('player', playerOptions, videoJsOptions);
const playlistManager = player.playlist(playlistConfig);
playlistManager.loadFirstItem();

const player2 = videoPlayer('player-2', player2Options);
const playlistManager2 = player2.playlist(playlistConfig2);
playlistManager2.loadFirstItem();
