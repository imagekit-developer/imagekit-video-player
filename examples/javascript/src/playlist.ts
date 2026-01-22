import { videoPlayer } from '@imagekit/video-player';
import '@imagekit/video-player/dist/styles.css';

const codeToDisplay = `
// HTML: <div id="player-container"></div>

import { videoPlayer } from '@imagekit/video-player';
import '@imagekit/video-player/dist/styles.css';

const player = videoPlayer('player', {
    imagekitId: 'zuqlyov9d', // Replace with your ImageKit ID
    logo: {
        showLogo: true,
        logoImageUrl: 'https://imagekit.io/icons/icon-144x144.png',
        logoOnclickUrl: 'https://imagekit.io/'
    }
}, {
    muted: true
});

player.playlist({
  sources: [
    {
      src: 'https://ik.imagekit.io/demo/sample-video.mp4',
      info: { title: 'Sample Video', subtitle: 'A subtitle for the video' },
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
    }
  ],
  options: {
    autoAdvance: 3, // Auto-advance after a 3-second delay
    repeat: true,
    presentUpcoming: 10,
    widgetProps: { direction: 'vertical' }
  }
});

playlistManager.loadFirstItem();
`;

// Mount the code to the display block
document.getElementById('code-display')!.textContent = codeToDisplay.trim();

// --- Actual Player Initialization ---
// Create a video element for the player to mount on
const player = videoPlayer('player', {
  imagekitId: 'zuqlyov9d', // Replace with your ImageKit ID
  logo: {
    showLogo: true,
    logoImageUrl: 'https://imagekit.io/icons/icon-144x144.png',
    logoOnclickUrl: 'https://imagekit.io/'
  }
}, {
  muted: true
});
const playlistManager = player.playlist({
  sources: [
    {
      src: 'https://ik.imagekit.io/demo/sample-video.mp4?tr=rt-180,so-2&v=1234',
      info: { title: 'Sample Video', subtitle: 'A subtitle for the video' },
      transformation: [
        {
          width: 1000,
          height: 500,
        }
      ]
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
    }
  ],
  options: {
    autoAdvance: 3,
    repeat: true,
    presentUpcoming: 10,
    widgetProps: { direction: 'vertical' }
  }
});

playlistManager.loadFirstItem();

const player2 = videoPlayer("player-2", {
  imagekitId: 'zuqlyov9d', // Replace with your ImageKit ID
  logo: {
    showLogo: true,
    logoImageUrl: 'https://imagekit.io/icons/icon-144x144.png',
    logoOnclickUrl: 'https://imagekit.io/'
  }
});


const playlistManager2 = player2.playlist({
  sources: [
    {
      src: 'https://ik.imagekit.io/demo/sample-video.mp4',
      info: { title: 'Sample Video', subtitle: 'A subtitle for the video' },
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
    }
  ],
  options: {
    autoAdvance: 3,
    repeat: true,
    presentUpcoming: 10,
    widgetProps: { direction: 'horizontal' }
  }
});

playlistManager2.loadFirstItem();
