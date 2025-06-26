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

player.src({
    src: 'https://ik.imagekit.io/demo/sample-video.mp4',
    textTracks: [
        // Example 1: Add a pre-existing subtitle file
        {
            src: 'https://ik.imagekit.io/demo/subtitles_en.vtt',
            kind: 'subtitles',
            srclang: 'en',
            label: 'English',
            default: true,
        },
        // Example 2: Use AI to auto-generate subtitles and then translate them
        {
            autoGenerateSubtitles: true,
            translate: [
                {
                    langCode: 'fr',
                    label: 'French (AI)',
                },
                {
                    langCode: 'de',
                    label: 'German (AI)',
                }
            ]
        }
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
    textTracks: [
        {
            src: 'https://ik.imagekit.io/demo/subtitles_en.vtt',
            kind: 'subtitles',
            srclang: 'en',
            label: 'English',
            default: true,
        },
        {
            autoGenerateSubtitles: true,
            translate: [
                {
                    langCode: 'fr',
                    label: 'French (AI)',
                },
                {
                    langCode: 'de',
                    label: 'German (AI)',
                }
            ]
        }
    ]
});