import { videoPlayer } from '@imagekit/video-player';
import '@imagekit/video-player/styles.css';
import { buildPlayerInitCode, formatObjectAsCode } from './codegen';

// --- Actual Player Initialization (single source of truth) ---
const playerOptions = {
  imagekitId: 'imagekit_id', // Replace with your ImageKit ID
  logo: {
    showLogo: true,
    logoImageUrl: 'https://imagekit.io/icons/icon-144x144.png',
    logoOnclickUrl: 'https://imagekit.io/',
  },
};

const srcConfig = {
  src: "https://ik.imagekit.io/ikmedia/docs/video-player/shoppable/video.mp4",
  shoppable: {
    products: [
      {
        productId: 1,
        productName: "Classic Aviators",
        highlightTime: { start: 2, end: 6 },
        imageUrl: "https://ik.imagekit.io/ikmedia/docs/video-player/shoppable/aviators.jpeg",
        hotspots: [
          {
            time: "00:06",
            x: "48%",
            y: "35%",
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
        productName: "Wooden frame glasses",
        imageUrl: "https://ik.imagekit.io/ikmedia/docs/video-player/shoppable/wooden_frames.jpeg",
        onHover: {
          action: "switch",
          args: {
            url: "https://ik.imagekit.io/ikmedia/docs/video-player/shoppable/wooden_frames.jpeg"
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
        imageUrl: "https://ik.imagekit.io/ikmedia/docs/video-player/shoppable/sunglass.jpeg",
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
        highlightTime: { start: 7, end: 9 },
        imageUrl: "https://ik.imagekit.io/ikmedia/docs/video-player/shoppable/protection.jpeg",
        onClick: {
          action: "goto",
          pause: true,
          args: {
            url: "https://www.pexels.com/photo/red-lens-sunglasses-on-sand-near-sea-at-sunset-selective-focus-photography-46710/"
          }
        }
      }
    ],
    showPostPlayOverlay: true,
    autoClose: false,
    startState: "open"
  }
};

const codeToDisplay = buildPlayerInitCode({
  htmlHint: '<video id="player" class="video-js" ...></video>',
  playerTarget: 'player',
  playerOptions,
  afterInitLines: [``, `player.src(${formatObjectAsCode(srcConfig)});`],
});

document.getElementById('code-display')!.textContent = codeToDisplay.trim();

// Helper function to initialize players
function initPlayer(playerId: string, options: typeof playerOptions, config: typeof srcConfig) {
  const player = videoPlayer(playerId, options);
  player.src(config);
}

// Initialize all players
initPlayer('player', playerOptions, srcConfig);