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
  src: "https://ik.imagekit.io/a1yisxurxo/aman/shoppable%20vidoes/shoppable_demo.mp4?updatedAt=1752633516273",
  shoppable: {
    products: [
      {
        productId: 1,
        productName: "Classic Aviators",
        highlightTime: { start: 2, end: 6 }, // Highlight from 0s to 6s
        imageUrl: "https://ik.imagekit.io/a1yisxurxo/aman/shoppable%20vidoes/glasses3.jpeg?updatedAt=1752632518026",
        hotspots: [
          {
            time: "00:06",
            x: "50%",
            y: "25%",
            tooltipPosition: "left",
            clickUrl: "https://images.pexels.com/photos/701877/pexels-photo-701877.jpeg"
          }
        ],
        onHover: {
          action: "overlay",
          args: "Click to see this product in the video"
        },
        onClick: {
          action: "seek",
          pause: 5,
          args: { time: "00:06" }
        }
      },
      {
        productId: 2,
        productName: "Wooden frame glasses for personal use",
        imageUrl: "https://ik.imagekit.io/a1yisxurxo/aman/shoppable%20vidoes/glasses2.jpeg?updatedAt=1752632501675",
        onHover: {
          action: "switch",
          args: {
            url: "https://ik.imagekit.io/a1yisxurxo/aman/shoppable%20vidoes/glasses.jpeg?updatedAt=1752632426600"
          }
        },
        onClick: {
          action: "goto",
          pause: true,
          args: { 
            url: "https://www.pexels.com/search/wooden%20glasses%20frames/"
           }
        }
      },
      {
        productId: 3,
        productName: "Sunglasses",
        imageUrl: "https://ik.imagekit.io/a1yisxurxo/aman/shoppable%20vidoes/sunglass.jpeg?updatedAt=1752633002810",
        onHover: {
          action: "overlay",
          args: "Click to go to website"
        },
        onClick: {
          action: "goto",
          pause: true,
          args: {
            url: "https://www.pexels.com/photo/red-lens-sunglasses-on-sand-near-sea-at-sunset-selective-focus-photography-46710/"
          }

        }
      },
      {
        productId: 4,
        productName: "Eye protection",
        highlightTime: { start: 7, end: 9 }, // Highlight from 0s to 6s
        imageUrl: "https://ik.imagekit.io/a1yisxurxo/aman/shoppable%20vidoes/protection.jpeg?updatedAt=1752633320623",
        onClick: {
          action: "goto",
          pause: true,
          args: {
            url: "https://www.pexels.com/photo/red-lens-sunglasses-on-sand-near-sea-at-sunset-selective-focus-photography-46710/"
          }
        }
      },
    ],
    showPostPlayOverlay: true,
    autoClose: false,
    startState: 'open'
  }
});
`;

document.getElementById('code-display')!.textContent = codeToDisplay.trim();

// --- Actual Player Initialization ---
const player = videoPlayer('player', {
  imagekitId: 'imagekit_id', // Replace with your ImageKit ID
});

player.src({
  src: "https://ik.imagekit.io/a1yisxurxo/aman/shoppable%20vidoes/shoppable_demo.mp4?updatedAt=1752633516273",
  shoppable: {
    products: [
      {
        productId: 1,
        productName: "Classic Aviators",
        highlightTime: { start: 2, end: 6 }, // Highlight from 0s to 6s
        imageUrl: "https://ik.imagekit.io/a1yisxurxo/aman/shoppable%20vidoes/glasses3.jpeg?updatedAt=1752632518026",
        hotspots: [
          {
            time: "00:06",
            x: "50%",
            y: "25%",
            tooltipPosition: "left",
            clickUrl: "https://images.pexels.com/photos/701877/pexels-photo-701877.jpeg"
          }
        ],
        onHover: {
          action: "overlay",
          args: "Click to see this product in the video"
        },
        onClick: {
          action: "seek",
          pause: 5,
          args: { time: "00:06" }
        }
      },
      {
        productId: 2,
        productName: "Wooden frame glasses for personal use",
        imageUrl: "https://ik.imagekit.io/a1yisxurxo/aman/shoppable%20vidoes/glasses2.jpeg?updatedAt=1752632501675",
        onHover: {
          action: "switch",
          args: {
            url: "https://ik.imagekit.io/a1yisxurxo/aman/shoppable%20vidoes/glasses.jpeg?updatedAt=1752632426600"
          }
        },
        onClick: {
          action: "goto",
          pause: true,
          args: { 
            url: "https://www.pexels.com/search/wooden%20glasses%20frames/"
           }
        }
      },
      {
        productId: 3,
        productName: "Sunglasses",
        imageUrl: "https://ik.imagekit.io/a1yisxurxo/aman/shoppable%20vidoes/sunglass.jpeg?updatedAt=1752633002810",
        onHover: {
          action: "overlay",
          args: "Click to go to website"
        },
        onClick: {
          action: "goto",
          pause: true,
          args: {
            url: "https://www.pexels.com/photo/red-lens-sunglasses-on-sand-near-sea-at-sunset-selective-focus-photography-46710/"
          }

        }
      },
      {
        productId: 4,
        productName: "Eye protection",
        highlightTime: { start: 7, end: 9 }, // Highlight from 0s to 6s
        imageUrl: "https://ik.imagekit.io/a1yisxurxo/aman/shoppable%20vidoes/protection.jpeg?updatedAt=1752633320623",
        onClick: {
          action: "goto",
          pause: true,
          args: {
            url: "https://www.pexels.com/photo/red-lens-sunglasses-on-sand-near-sea-at-sunset-selective-focus-photography-46710/"
          }
        }
      },
    ],
    showPostPlayOverlay: true,
    autoClose: false,
    startState: 'open'
  }
});