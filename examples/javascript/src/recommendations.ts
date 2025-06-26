import { videoPlayer } from '@imagekit/video-player';
import '@imagekit/video-player/dist/styles.css';

const codeToDisplay = `
// HTML: <video id="player" class="video-js" ...></video>

import { videoPlayer } from '@imagekit/video-player';
import '@imagekit/video-player/dist/styles.css';

const player = videoPlayer('player', {
    imagekitId: 'your_id',
});

player.src({
    src: 'https://ik.imagekit.io/demo/sample-video.mp4',
    recommendations: [
        {
            src: 'https://ik.imagekit.io/demo/video2.mp4',
            info: { title: 'Watch This Next!', subtitle: 'A great choice' }
        },
        {
            src: 'https://ik.imagekit.io/demo/video3.mp4',
            info: { title: 'Or Maybe This One?', subtitle: 'Another option' }
        },
        // Add up to 4 recommendations
    ]
});
`;

document.getElementById('code-display')!.textContent = codeToDisplay.trim();

// --- Actual Player Initialization ---
const player = videoPlayer('player', {
    imagekitId: 'zuqlyov9d', // Replace with your ImageKit ID
});

player.src({
    src: 'https://ik.imagekit.io/demo/sample-video.mp4',
    recommendations: [
        {
            src: 'https://ik.imagekit.io/zuqlyov9d/SEO-friendly%20file%20names.mp4',
            info: { title: 'Watch This Next!', subtitle: 'A great choice' },
        },
        {
            src: 'https://ik.imagekit.io/zuqlyov9d/example_video_2.mp4',
            info: { title: 'Or Maybe This One?', subtitle: 'Another option' },
        },
         {
            src: 'https://ik.imagekit.io/demo/sample-video.mp4',
            info: { title: 'Watch The First One Again', subtitle: 'A classic' },
        }
    ]
});