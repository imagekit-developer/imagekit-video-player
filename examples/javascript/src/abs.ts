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
    src: 'https://stage-ik.imagekit.io/nnstage/Videos/sample_1280x720_surfing_with_audio.mp4?updatedAt=1768289286866',
    abs: {
        protocol: 'dash',
        sr: [240, 360, 720, 1080]
    }
})

const player2 = videoPlayer("player-2", {
    imagekitId: 'imagekit_id', // Replace with your ImageKit ID
});

player2.src({
    src: 'https://stage-ik.imagekit.io/nnstage/Videos/sample_1280x720_surfing_with_audio.mp4?updatedAt=1768289286866',
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
    logo: {
        showLogo: true,
        logoImageUrl: 'https://imagekit.io/icons/icon-144x144.png',
        logoOnclickUrl: 'https://imagekit.io/'
    }
}, {
    muted: true
});

player.src({
    src: 'https://stage-ik.imagekit.io/nnstage/Videos/sample_1280x720_surfing_with_audio.mp4',
    abs: {
        protocol: 'dash',
        sr: [240, 360, 720, 1080]
    }
})

const player2 = videoPlayer("player-2", {
    imagekitId: 'zuqlyov9d', // Replace with your ImageKit ID
    logo: {
        showLogo: true,
        logoImageUrl: 'https://imagekit.io/icons/icon-144x144.png',
        logoOnclickUrl: 'https://imagekit.io/'
    }
}, {
    muted: true
});

player2.src({
    src: 'https://stage-ik.imagekit.io/nnstage/Videos/sample_1280x720_surfing_with_audio.mp4',
    abs: {
        protocol: 'hls',
        sr: [240, 360, 720, 1080]
    }
})
