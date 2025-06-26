// import { videoPlayer } from '@imagekit/video-player';
// import '@imagekit/video-player/dist/styles.css';

// const player = videoPlayer('video', {
//   imagekitId: 'YOUR_IMAGEKIT_ID',
//   seekThumbnails: true,
//   floatingWhenNotVisible: "right",
//   logo: {
//     showLogo: true,
//     logoImageUrl: 'https://ik.imgkit.net/ikmedia/logo/light_T4buIzohVH.svg',
//     logoOnclickUrl: 'https://imagekit.io/',
//   },
// });

// const playlistManager = player.playlist({
//   sources: [
//     {
//       src: 'https://ik.imagekit.io/zuqlyov9d/SEO-friendly%20file%20names.mp4',
//       transformation: [
//         { width: 400, height: 400 },
//       ],
//       chapters: true,
//       info: { title: 'Dog', subtitle: 'Dog wearing cap', description: 'This is a video containing dog wearing cap.' },
//     },
//     {
//       src: 'https://ik.imagekit.io/zuqlyov9d/example_video_2.mp4',
//       transformation: [
//         { width: 400, height: 400 },
//       ],
//       chapters: true,
//       info: { title: 'Human: some very long title that cant be displayed in one line. Multiple lines are required.', subtitle: 'Human lying in grass', description: 'This is a video showing human lying on the grass. He is smiling.' },
//       textTracks: [
//         // {
//         //   autoGenerateSubtitles: true,
//         //   maxWords: 4,
//         //   wordHighlight: true,
//         //   default: true // Indicates whether this track is active by default
//         // },
//         {
//           autoGenerateSubtitles: true,
//           translate: [
//             {
//               langCode: 'fr',
//               label: 'French auto-generated',
//               default: true // Indicates whether this track is active by default
//             },
//             {
//               langCode: 'de',
//               label: 'German auto-generated',
//               default: false // Indicates whether this track is active by default
//             }
//           ]
//         }
//       ]
//     },
//     {
//       src: 'https://ik.imagekit.io/zuqlyov9d/sample-video.mp4',
//       chapters: true,
//       info: { title: 'Bird', subtitle: 'Bird on a branch', description: 'This video depicts bird chirping. It is sitting on a tree branch.' },
//       shoppable: {
//         transformation: [{ height: "300", width: "400" }],
//         products: [
//           {
//             productId: 1,
//             productName: "Sunglasses",
//             highlightTime: { start: 0, end: 2 },
//             imageUrl: "https://ik.imagekit.io/a1yisxurxo/women_in_red_2nd_test_L0pnP7Hb3.jpg?updatedAt=1744896751866",
//             hotspots: [
//               {
//                 time: "00:02",
//                 x: "50%",
//                 y: "50%",
//                 tooltipPosition: "left",
//                 clickUrl: "https://imagekit.io/dashboard/media-library/detail/680102eb432c476416cdd342"
//               }
//             ],
//             onHover: {
//               action: "overlay",
//               args: "Click to see this product in the video"
//             },
//             onClick: {
//               action: "seek",
//               pause: 5,
//               args: { time: "00:02" }
//             }
//           },
//           {
//             productId: 1,
//             productName: "Sunglasses",
//             highlightTime: { start: 0, end: 2 },
//             imageUrl: "https://ik.imagekit.io/a1yisxurxo/women_in_red_2nd_test_L0pnP7Hb3.jpg?updatedAt=1744896751866",
//             hotspots: [
//               {
//                 time: "00:02",
//                 x: "50%",
//                 y: "50%",
//                 tooltipPosition: "left",
//                 clickUrl: "https://imagekit.io/dashboard/media-library/detail/680102eb432c476416cdd342"
//               }
//             ],
//             onHover: {
//               action: "overlay",
//               args: "Click to see this product in the video"
//             },
//             onClick: {
//               action: "seek",
//               pause: 5,
//               args: { time: "00:02" }
//             }
//           },
//           {
//             productId: 1,
//             productName: "Hat",
//             highlightTime: { start: 0, end: 2 },
//             imageUrl: "https://ik.imagekit.io/a1yisxurxo/women_in_red_2nd_test_L0pnP7Hb3.jpg?updatedAt=1744896751866",
//             hotspots: [
//               {
//                 time: "00:02",
//                 x: "50%",
//                 y: "50%",
//                 tooltipPosition: "left",
//                 clickUrl: "https://imagekit.io/dashboard/media-library/detail/680102eb432c476416cdd342"
//               }
//             ],
//             onHover: {
//               action: "overlay",
//               args: "Click to see this product in the video"
//             },
//             onClick: {
//               action: "seek",
//               pause: 5,
//               args: { time: "00:04" }
//             }
//           },
//           {
//             productId: 1,
//             productName: "Shorts",
//             highlightTime: { start: 0, end: 2 },
//             imageUrl: "https://ik.imagekit.io/a1yisxurxo/women_in_red_2nd_test_L0pnP7Hb3.jpg?updatedAt=1744896751866",
//             hotspots: [
//               {
//                 time: "00:02",
//                 x: "50%",
//                 y: "50%",
//                 tooltipPosition: "left",
//                 clickUrl: "https://imagekit.io/dashboard/media-library/detail/680102eb432c476416cdd342"
//               }
//             ],
//             onHover: {
//               action: "overlay",
//               args: "Click to see this product in the video"
//             },
//             onClick: {
//               action: "seek",
//               pause: 5,
//               args: { time: "00:06" }
//             }
//           },
//           {
//             productId: 1,
//             productName: "Shorts",
//             highlightTime: { start: 0, end: 2 },
//             imageUrl: "https://ik.imagekit.io/a1yisxurxo/women_in_red_2nd_test_L0pnP7Hb3.jpg?updatedAt=1744896751866",
//             hotspots: [
//               {
//                 time: "00:02",
//                 x: "50%",
//                 y: "50%",
//                 tooltipPosition: "left",
//                 clickUrl: "https://imagekit.io/dashboard/media-library/detail/680102eb432c476416cdd342"
//               }
//             ],
//             onHover: {
//               action: "overlay",
//               args: "Click to see this product in the video"
//             },
//             onClick: {
//               action: "seek",
//               pause: 5,
//               args: { time: "00:06" }
//             }
//           },
//           {
//             productId: 1,
//             productName: "Shorts",
//             highlightTime: { start: 0, end: 2 },
//             imageUrl: "https://ik.imagekit.io/a1yisxurxo/women_in_red_2nd_test_L0pnP7Hb3.jpg?updatedAt=1744896751866",
//             hotspots: [
//               {
//                 time: "00:02",
//                 x: "50%",
//                 y: "50%",
//                 tooltipPosition: "left",
//                 clickUrl: "https://imagekit.io/dashboard/media-library/detail/680102eb432c476416cdd342"
//               }
//             ],
//             onHover: {
//               action: "overlay",
//               args: "Click to see this product in the video"
//             },
//             onClick: {
//               action: "seek",
//               pause: 5,
//               args: { time: "00:06" }
//             }
//           },
//           {
//             productId: 1,
//             productName: "Shorts",
//             highlightTime: { start: 0, end: 2 },
//             imageUrl: "https://ik.imagekit.io/a1yisxurxo/women_in_red_2nd_test_L0pnP7Hb3.jpg?updatedAt=1744896751866",
//             hotspots: [
//               {
//                 time: "00:02",
//                 x: "50%",
//                 y: "50%",
//                 tooltipPosition: "left",
//                 clickUrl: "https://imagekit.io/dashboard/media-library/detail/680102eb432c476416cdd342"
//               }
//             ],
//             onHover: {
//               action: "overlay",
//               args: "Click to see this product in the video"
//             },
//             onClick: {
//               action: "seek",
//               pause: 5,
//               args: { time: "00:06" }
//             }
//           },
//           {
//             productId: 1,
//             productName: "Shorts",
//             highlightTime: { start: 0, end: 2 },
//             imageUrl: "https://ik.imagekit.io/a1yisxurxo/women_in_red_2nd_test_L0pnP7Hb3.jpg?updatedAt=1744896751866",
//             hotspots: [
//               {
//                 time: "00:02",
//                 x: "50%",
//                 y: "50%",
//                 tooltipPosition: "left",
//                 clickUrl: "https://imagekit.io/dashboard/media-library/detail/680102eb432c476416cdd342"
//               }
//             ],
//             onHover: {
//               action: "overlay",
//               args: "Click to see this product in the video"
//             },
//             onClick: {
//               action: "seek",
//               pause: 5,
//               args: { time: "00:06" }
//             }
//           },
//           {
//             productId: 1,
//             productName: "Shorts",
//             highlightTime: { start: 0, end: 2 },
//             imageUrl: "https://ik.imagekit.io/a1yisxurxo/women_in_red_2nd_test_L0pnP7Hb3.jpg?updatedAt=1744896751866",
//             hotspots: [
//               {
//                 time: "00:02",
//                 x: "50%",
//                 y: "50%",
//                 tooltipPosition: "left",
//                 clickUrl: "https://imagekit.io/dashboard/media-library/detail/680102eb432c476416cdd342"
//               }
//             ],
//             onHover: {
//               action: "overlay",
//               args: "Click to see this product in the video"
//             },
//             onClick: {
//               action: "seek",
//               pause: 5,
//               args: { time: "00:06" }
//             }
//           },
//           {
//             productId: 1,
//             productName: "Shorts",
//             highlightTime: { start: 0, end: 2 },
//             imageUrl: "https://ik.imagekit.io/a1yisxurxo/women_in_red_2nd_test_L0pnP7Hb3.jpg?updatedAt=1744896751866",
//             hotspots: [
//               {
//                 time: "00:02",
//                 x: "50%",
//                 y: "50%",
//                 tooltipPosition: "left",
//                 clickUrl: "https://imagekit.io/dashboard/media-library/detail/680102eb432c476416cdd342"
//               }
//             ],
//             onHover: {
//               action: "overlay",
//               args: "Click to see this product in the video"
//             },
//             onClick: {
//               action: "seek",
//               pause: 5,
//               args: { time: "00:06" }
//             }
//           },
//           // …two more products…
//         ],
//         showPostPlayOverlay: true,
//         autoClose: false
//       }
//     },
//     {
//       src: 'https://ik.imagekit.io/zuqlyov9d/SEO-friendly%20file%20names.mp4',
//       transformation: [
//         { width: 400, height: 400 },
//       ],
//       chapters: true,
//       info: { title: 'Dog 2', subtitle: 'Dog wearing cap', description: 'This is a video containing dog wearing cap.' },
//       recommendations: [
//         {
//           src: 'https://ik.imagekit.io/ikmedia/docs_images/examples/Videos/example_video_2.mp4', info: {
//             title: 'Next Up',
//             subtitle: 'Subtitle that is a little long',
//             description: 'A very long description that will be truncated if it is too long. A very long description that will be truncated if it is too long. A very long description that will be truncated if it is too long. A very long description that will be truncated if it is too long.',
//           },
//           poster: {
//             src: "https://ik.imagekit.io/ikmedia/docs_images/examples/Videos/example_video_2.mp4/ik-thumbnail.jpg"
//           }
//         },
//         {
//           src: 'https://ik.imagekit.io/zuqlyov9d/ik-67/upload-test-file.m4v/ik-video.mp4?updatedAt=1747196767622', info: { title: 'Next Up' },
//           poster: {
//             src: "https://ik.imagekit.io/ikmedia/docs_images/examples/Videos/example_video_2.mp4/ik-thumbnail.jpg"
//           }
//         },
//         {
//           src: 'https://ik.imagekit.io/zuqlyov9d/ik-67/upload-test-file.m4v/ik-video.mp4?updatedAt=1747196767622', info: { title: 'Next Up' },
//           poster: {
//             src: "https://ik.imagekit.io/ikmedia/docs_images/examples/Videos/example_video_2.mp4/ik-thumbnail.jpg"
//           }
//         },
//         {
//           src: 'https://ik.imagekit.io/zuqlyov9d/ik-67/upload-test-file.m4v/ik-video.mp4?updatedAt=1747196767622', info: { title: 'Next Up' },
//           poster: {
//             src: "https://ik.imagekit.io/ikmedia/docs_images/examples/Videos/example_video_2.mp4/ik-thumbnail.jpg"
//           }
//         },
//         {
//           src: 'https://ik.imagekit.io/zuqlyov9d/ik-67/upload-test-file.m4v/ik-video.mp4?updatedAt=1747196767622', info: { title: 'Next Up' },
//           poster: {
//             src: "https://ik.imagekit.io/ikmedia/docs_images/examples/Videos/example_video_2.mp4/ik-thumbnail.jpg"
//           }
//         },
//         {
//           src: 'https://ik.imagekit.io/zuqlyov9d/ik-67/upload-test-file.m4v/ik-video.mp4?updatedAt=1747196767622', info: { title: 'Video 1' },
//         },
//         {
//           src: 'https://ik.imagekit.io/zuqlyov9d/ik-67/upload-test-file.m4v/ik-video.mp4?updatedAt=1747196767622', info: { title: 'Something that is very long title. Too long to fit in one line. Multiple lines required.' },
//           poster: {
//             src: "https://ik.imagekit.io/ikmedia/docs_images/examples/Videos/example_video_2.mp4/ik-thumbnail.jpg"
//           }
//         },
//         {
//           src: 'https://ik.imagekit.io/zuqlyov9d/ik-67/upload-test-file.m4v/ik-video.mp4?updatedAt=1747196767622', info: { title: 'Video 3' },
//           poster: {
//             src: "https://ik.imagekit.io/ikmedia/docs_images/examples/Videos/example_video_2.mp4/ik-thumbnail.jpg"
//           }
//         },
//         {
//           src: 'https://ik.imagekit.io/zuqlyov9d/ik-67/upload-test-file.m4v/ik-video.mp4?updatedAt=1747196767622', info: { title: 'Video 4' },
//         },

//       ],
//     },
//     {
//       src: 'https://ik.imagekit.io/zuqlyov9d/SEO-friendly%20file%20names.mp4',
//       transformation: [
//         { width: 400, height: 400 },
//       ],
//       chapters: true,
//       info: { title: 'Dog 3', subtitle: 'Dog wearing cap', description: 'This is a video containing dog wearing cap.' },
//       // shoppable: {
//       //   transformation: [{ height: "300", width: "400" }],
//       //   products: [
//       //     {
//       //       productId: 1,
//       //       productName: "Sunglasses",
//       //       highlightTime: { start: 0, end: 2 },
//       //       imageUrl: "https://ik.imagekit.io/a1yisxurxo/women_in_red_2nd_test_L0pnP7Hb3.jpg?updatedAt=1744896751866",
//       //       hotspots: [
//       //         {
//       //           time: "00:02",
//       //           x: "50%",
//       //           y: "50%",
//       //           tooltipPosition: "left",
//       //           clickUrl: "https://imagekit.io/dashboard/media-library/detail/680102eb432c476416cdd342"
//       //         }
//       //       ],
//       //       onHover: {
//       //         action: "overlay",
//       //         args: "Click to see this product in the video"
//       //       },
//       //       onClick: {
//       //         action: "seek",
//       //         pause: 5,
//       //         args: { time: "00:02" }
//       //       }
//       //     },
//       //     {
//       //       productId: 1,
//       //       productName: "Sunglasses",
//       //       highlightTime: { start: 0, end: 2 },
//       //       imageUrl: "https://ik.imagekit.io/a1yisxurxo/women_in_red_2nd_test_L0pnP7Hb3.jpg?updatedAt=1744896751866",
//       //       hotspots: [
//       //         {
//       //           time: "00:02",
//       //           x: "50%",
//       //           y: "50%",
//       //           tooltipPosition: "left",
//       //           clickUrl: "https://imagekit.io/dashboard/media-library/detail/680102eb432c476416cdd342"
//       //         }
//       //       ],
//       //       onHover: {
//       //         action: "overlay",
//       //         args: "Click to see this product in the video"
//       //       },
//       //       onClick: {
//       //         action: "seek",
//       //         pause: 5,
//       //         args: { time: "00:02" }
//       //       }
//       //     },
//       //     {
//       //       productId: 1,
//       //       productName: "Hat",
//       //       highlightTime: { start: 0, end: 2 },
//       //       imageUrl: "https://ik.imagekit.io/a1yisxurxo/women_in_red_2nd_test_L0pnP7Hb3.jpg?updatedAt=1744896751866",
//       //       hotspots: [
//       //         {
//       //           time: "00:02",
//       //           x: "50%",
//       //           y: "50%",
//       //           tooltipPosition: "left",
//       //           clickUrl: "https://imagekit.io/dashboard/media-library/detail/680102eb432c476416cdd342"
//       //         }
//       //       ],
//       //       onHover: {
//       //         action: "overlay",
//       //         args: "Click to see this product in the video"
//       //       },
//       //       onClick: {
//       //         action: "seek",
//       //         pause: 5,
//       //         args: { time: "00:04" }
//       //       }
//       //     },
//       //     {
//       //       productId: 1,
//       //       productName: "Shorts",
//       //       highlightTime: { start: 0, end: 2 },
//       //       imageUrl: "https://ik.imagekit.io/a1yisxurxo/women_in_red_2nd_test_L0pnP7Hb3.jpg?updatedAt=1744896751866",
//       //       hotspots: [
//       //         {
//       //           time: "00:02",
//       //           x: "50%",
//       //           y: "50%",
//       //           tooltipPosition: "left",
//       //           clickUrl: "https://imagekit.io/dashboard/media-library/detail/680102eb432c476416cdd342"
//       //         }
//       //       ],
//       //       onHover: {
//       //         action: "overlay",
//       //         args: "Click to see this product in the video"
//       //       },
//       //       onClick: {
//       //         action: "seek",
//       //         pause: 5,
//       //         args: { time: "00:06" }
//       //       }
//       //     },
//       //     // …two more products…
//       //   ],
//       //   toggleIconUrl: "https://ik.imgkit.net/ikmedia/logo/light_T4buIzohVH.svg"
//       // }
//     },
//   ], options: {
//     autoAdvance: 2,
//     repeat: true,
//     presentUpcoming: 2,
//     widgetProps: { direction: 'vertical' }
//   }
// })

// player.on(['loadstart'], () => {
//   console.log('loadstart fired');
// });

// player.on(['loadedmetadata'], () => {
//   console.log('Metadata loaded');
// });

// player.on(['loadeddata'], () => {
//   console.log('data loaded fired');
// });

// playlistManager.loadFirstItem();


import { videoPlayer } from '@imagekit/video-player';
import '@imagekit/video-player/dist/styles.css';

const codeToDisplay = `
// HTML: <div id="player-container"></div>

import { videoPlayer } from '@imagekit/video-player';
import '@imagekit/video-player/dist/styles.css';

const player = videoPlayer('player-container', {
  imagekitId: 'your_id',
});

player.playlist({
  sources: [
    {
      src: 'https://ik.imagekit.io/demo/sample-video.mp4',
      info: { title: 'Sample Video', subtitle: 'A subtitle for the video' },
    },
    {
      src: 'https://ik.imagekit.io/zuqlyov9d/SEO-friendly%20file%20names.mp4',
      info: { title: 'Another Video', subtitle: 'This one is different' },
    },
    {
      src: 'https://ik.imagekit.io/zuqlyov9d/example_video_2.mp4',
      info: { title: 'Third Time Is The Charm', subtitle: 'The final video' },
    },
     {
      src: 'https://ik.imagekit.io/demo/sample-video.mp4',
      info: { title: 'A very long name. It will not fit in the single line.', subtitle: 'Video 4' },
    },
    {
      src: 'https://ik.imagekit.io/zuqlyov9d/SEO-friendly%20file%20names.mp4',
      info: { title: 'Video 5', subtitle: 'Video 5' },
    },
    {
      src: 'https://ik.imagekit.io/zuqlyov9d/example_video_2.mp4',
      info: { title: 'Video 6', subtitle: 'Video 6' },
    }
  ],
  options: {
    autoAdvance: 3, // Auto-advance after a 3-second delay
    repeat: true,
    presentUpcoming: 10,
    widgetProps: { direction: 'vertical' }
  }
});

playlistManager.loadFirstItem();
`;

// Mount the code to the display block
document.getElementById('code-display')!.textContent = codeToDisplay.trim();

// --- Actual Player Initialization ---
// Create a video element for the player to mount on
const player = videoPlayer("player", {
  imagekitId: 'zuqlyov9d', // Replace with your ImageKit ID
});

const playlistManager = player.playlist({
  sources: [
    {
      src: 'https://ik.imagekit.io/demo/sample-video.mp4',
      info: { title: 'Sample Video', subtitle: 'A subtitle for the video' },
    },
    {
      src: 'https://ik.imagekit.io/zuqlyov9d/SEO-friendly%20file%20names.mp4',
      info: { title: 'Another Video', subtitle: 'This one is different' },
    },
    {
      src: 'https://ik.imagekit.io/zuqlyov9d/example_video_2.mp4',
      info: { title: 'Third Time Is The Charm', subtitle: 'The final video' },
    },
    {
      src: 'https://ik.imagekit.io/demo/sample-video.mp4',
      info: { title: 'A very long name. It will not fit in the single line.', subtitle: 'Video 4' },
    },
    {
      src: 'https://ik.imagekit.io/zuqlyov9d/SEO-friendly%20file%20names.mp4',
      info: { title: 'Video 5', subtitle: 'Video 5' },
    },
    {
      src: 'https://ik.imagekit.io/zuqlyov9d/example_video_2.mp4',
      info: { title: 'Video 6', subtitle: 'Video 6' },
    }
  ],
  options: {
    autoAdvance: 3,
    repeat: true,
    presentUpcoming: 10,
    widgetProps: { direction: 'vertical' }
  }
});

playlistManager.loadFirstItem();

const player2 = videoPlayer("player-2", {
  imagekitId: 'zuqlyov9d', // Replace with your ImageKit ID
});


const playlistManager2 = player2.playlist({
  sources: [
    {
      src: 'https://ik.imagekit.io/demo/sample-video.mp4',
      info: { title: 'Sample Video', subtitle: 'A subtitle for the video' },
    },
    {
      src: 'https://ik.imagekit.io/zuqlyov9d/SEO-friendly%20file%20names.mp4',
      info: { title: 'Another Video', subtitle: 'This one is different' },
    },
    {
      src: 'https://ik.imagekit.io/zuqlyov9d/example_video_2.mp4',
      info: { title: 'Third Time Is The Charm', subtitle: 'The final video' },
    },
    {
      src: 'https://ik.imagekit.io/demo/sample-video.mp4',
      info: { title: 'A very long name. It will not fit in the single line.', subtitle: 'Video 4' },
    },
    {
      src: 'https://ik.imagekit.io/zuqlyov9d/SEO-friendly%20file%20names.mp4',
      info: { title: 'Video 5', subtitle: 'Video 5' },
    },
    {
      src: 'https://ik.imagekit.io/zuqlyov9d/example_video_2.mp4',
      info: { title: 'Video 6', subtitle: 'Video 6' },
    }
  ],
  options: {
    autoAdvance: 3,
    repeat: true,
    presentUpcoming: 10,
    widgetProps: { direction: 'horizontal' }
  }
});

playlistManager2.loadFirstItem();
