import { videoPlayer } from '@imagekit/video-player';
import '@imagekit/video-player/dist/styles.css';

const codeToDisplay = `
// HTML: <div id="player-container"></div>

import { videoPlayer } from '@imagekit/video-player';
import '@imagekit/video-player/dist/styles.css';

const player = videoPlayer("player", {
    imagekitId: 'imagekit_id', // Replace with your ImageKit ID
});

player.src({
    src: 'https://ik.imagekit.io/demo/sample-video.mp4',
    abs: {
        protocol: 'dash',
        sr: [240, 360, 720, 1080]
    }
})

const player2 = videoPlayer("player-2", {
    imagekitId: 'imagekit_id', // Replace with your ImageKit ID
});

player2.src({
    src: 'https://ik.imagekit.io/demo/sample-video.mp4',
    abs: {
        protocol: 'hls',
        sr: [240, 360, 720, 1080]
    }
})
`;

// Mount the code to the display block
document.getElementById('code-display')!.textContent = codeToDisplay.trim();

// --- Actual Player Initialization ---
// Create a video element for the player to mount on
const player = videoPlayer("player", {
    imagekitId: 'zuqlyov9d', // Replace with your ImageKit ID
}, {
    muted: true
});

player.src({
    src: 'https://ik.imagekit.io/demo/sample-video.mp4',
    abs: {
        protocol: 'dash',
        sr: [240, 360, 720, 1080]
    }
})

const player2 = videoPlayer("player-2", {
    imagekitId: 'zuqlyov9d', // Replace with your ImageKit ID
}, {
    muted: true
});

player2.src({
    src: 'https://ik.imagekit.io/demo/sample-video.mp4',
    abs: {
        protocol: 'hls',
        sr: [240, 360, 720, 1080]
    }
})
