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
    shoppable: {
        startState: 'openOnPlay',
        autoClose: 5, // Auto-close panel after 5s of inactivity
        products: [
            {
                productId: 'sunglasses_01',
                productName: 'Classic Aviators',
                imageUrl: 'https://ik.imagekit.io/demo/p/sunglasses.jpeg',
                highlightTime: { start: 2, end: 5 },
                onClick: {
                    action: 'seek',
                    args: { time: '00:03' }
                },
                onHover: {
                    action: 'overlay',
                    args: 'Featured Sunglasses'
                }
            },
            {
                productId: 'watch_02',
                productName: 'Chronograph Watch',
                imageUrl: 'https://ik.imagekit.io/demo/p/watch.jpeg',
                highlightTime: { start: 6, end: 9 },
                onClick: {
                    action: 'goto',
                    args: { url: 'https://imagekit.io' },
                    pause: true
                },
                onHover: {
                  action: 'switch',
                  args: { url: 'https://ik.imagekit.io/demo/p/watch_2.jpeg' }
                }
            }
        ]
    }
});
`;

document.getElementById('code-display')!.textContent = codeToDisplay.trim();

// --- Actual Player Initialization ---
const player = videoPlayer('player', {
    imagekitId: 'zuqlyov9d', // Replace with your ImageKit ID
});

player.src({
    src: 'https://ik.imagekit.io/demo/sample-video.mp4',
    shoppable: {
        startState: 'openOnPlay',
        autoClose: 5,
        products: [
            {
                productId: 'sunglasses_01',
                productName: 'Classic Aviators',
                imageUrl: 'https://ik.imagekit.io/demo/p/sunglasses.jpeg',
                highlightTime: { start: 2, end: 5 },
                onClick: {
                    action: 'seek',
                    args: { time: '00:03' }
                },
                onHover: {
                    action: 'overlay',
                    args: 'Featured Sunglasses'
                }
            },
            {
                productId: 'watch_02',
                productName: 'Chronograph Watch',
                imageUrl: 'https://ik.imagekit.io/demo/p/watch.jpeg',
                highlightTime: { start: 6, end: 9 },
                onClick: {
                    action: 'goto',
                    args: { url: 'https://imagekit.io' },
                    pause: true
                },
                onHover: {
                  action: 'switch',
                  args: { url: 'https://ik.imagekit.io/demo/p/watch_2.jpeg' }
                }
            }
        ]
    }
});