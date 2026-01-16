import { videoPlayer } from '@imagekit/video-player';
import '@imagekit/video-player/dist/styles.css';

const codeToDisplay = `
// HTML: <video id="player" class="video-js" ...></video>

import { videoPlayer } from '@imagekit/video-player';
import '@imagekit/video-player/dist/styles.css';

const player = videoPlayer('player', {
    imagekitId: 'your_id',
    logo: {
        showLogo: true,
        logoImageUrl: 'https://imagekit.io/icons/icon-144x144.png',
        logoOnclickUrl: 'https://imagekit.io/'
    }
});

// Set video source
player.src({
    src: 'https://ik.imagekit.io/zuqlyov9d/example_video_2.mp4'
});

/*
// Logo Configuration Options:
// - showLogo: boolean - Controls visibility of the logo button
// - logoImageUrl: string - URL of the logo image to display
// - logoOnclickUrl: string - URL to navigate to when logo is clicked

// Example: Hide logo
const player = videoPlayer('player', {
    imagekitId: 'your_id',
    logo: {
        showLogo: false,
        logoImageUrl: '',
        logoOnclickUrl: ''
    }
});
*/
`;

document.getElementById('code-display')!.textContent = codeToDisplay.trim();

// --- Actual Player Initialization ---
const player = videoPlayer('player', {
    imagekitId: 'zuqlyov9d', // Replace with your ImageKit ID
    logo: {
        showLogo: true,
        logoImageUrl: 'https://imagekit.io/icons/icon-144x144.png',
        logoOnclickUrl: 'https://imagekit.io/'
    }
});

// Set video source
player.src({
    src: 'https://ik.imagekit.io/zuqlyov9d/example_video_2.mp4'
});
