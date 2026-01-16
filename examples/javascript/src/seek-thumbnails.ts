import { videoPlayer } from '@imagekit/video-player';
import '@imagekit/video-player/dist/styles.css';

const codeToDisplay = `
// HTML: <video id="player" class="video-js" ...></video>

import { videoPlayer } from '@imagekit/video-player';
import '@imagekit/video-player/dist/styles.css';

// To enable seek thumbnails, simply set the option to 'true'
// during player initialization. ImageKit will automatically
// generate the necessary sprite sheet from the source video.
const player = videoPlayer('player', {
    imagekitId: 'your_id',
    width: 960,
    height: 540,
    seekThumbnails: true,
});

player.src({
    src: 'https://ik.imagekit.io/zuqlyov9d/example_video_2.mp4',
});
`;

document.getElementById('code-display')!.textContent = codeToDisplay.trim();

// --- Actual Player Initialization ---
const player = videoPlayer('player', {
    imagekitId: 'zuqlyov9d', // Replace with your ImageKit ID
    seekThumbnails: true,
    logo: {
        showLogo: true,
        logoImageUrl: 'https://imagekit.io/icons/icon-144x144.png',
        logoOnclickUrl: 'https://imagekit.io/'
    }
}, {
    muted: true
});

player.src({
    src: 'https://stage-ik.imagekit.io/a8fli6vdg/New%20Folder33/JackMa_RuBbxVpuX.mp4?updatedAt=1762764326271&version=yashtest3&ik=debug=true',
});