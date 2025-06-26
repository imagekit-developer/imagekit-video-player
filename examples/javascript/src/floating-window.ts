import { videoPlayer } from '@imagekit/video-player';
import '@imagekit/video-player/dist/styles.css';

const codeToDisplay = `
// HTML: <video id="player" class="video-js" ...></video>

import { videoPlayer } from '@imagekit/video-player';
import '@imagekit/video-player/dist/styles.css';

const player = videoPlayer('player', {
    imagekitId: 'your_id',
    width: 960,
    height: 540,
    // Enable floating player in the bottom right corner
    floatingWhenNotVisible: 'right', 
});

player.src({
    src: 'https://ik.imagekit.io/demo/sample-video.mp4',
});
`;

document.getElementById('code-display')!.textContent = codeToDisplay.trim();

// --- Actual Player Initialization ---
const player = videoPlayer('player', {
    imagekitId: 'zuqlyov9d', // Replace with your ImageKit ID
    floatingWhenNotVisible: 'right',
});

player.src({
    src: 'https://ik.imagekit.io/demo/sample-video.mp4',
});