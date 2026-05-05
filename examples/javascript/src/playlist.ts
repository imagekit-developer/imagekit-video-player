import { videoPlayer } from '@imagekit/video-player';
import '@imagekit/video-player/styles.css';
import { formatObjectAsCode } from './codegen';

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

const playlistConfig = {
  sources: [
    {
      src: "https://ik.imagekit.io/ikmedia/docs/video-player/playlist/horses.mp4",
      info: { title: "Horses Running", description: "Horses grazing in the field" },
    },
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
      info: { title: "Rhino at the zoo"},
    },
    {
      src: "https://ik.imagekit.io/demo/sample-video.mp4",
      info: { title: "Bird on branch"}
    }
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
import '@imagekit/video-player/styles.css';

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
