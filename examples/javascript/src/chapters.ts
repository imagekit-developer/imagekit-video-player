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
});

// Example 1: Using AI-based chapters by setting chapters: true
player.src({
    src: 'https://ik.imagekit.io/demo/sample-video.mp4',
    chapters: true 
});

/*
// Example 2: Providing a VTT file for chapters
player.src({
    src: 'https://ik.imagekit.io/demo/sample-video.mp4',
    chapters: {
        url: 'https://ik.imagekit.io/demo/chapters_example.vtt'
    }
});
*/
`;

document.getElementById('code-display')!.textContent = codeToDisplay.trim();

// --- Actual Player Initialization ---
const player = videoPlayer('player', {
    imagekitId: 'zuqlyov9d', // Replace with your ImageKit ID
});

// Using AI-based chapters for this live demo
player.src({
    src: 'https://ik.imagekit.io/demo/sample-video.mp4',
    chapters: true 
});