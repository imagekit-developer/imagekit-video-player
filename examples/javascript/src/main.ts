import { videoPlayer } from '@imagekit/video-player';
import '@imagekit/video-player/dist/styles.css';
// import ImageKit from "imagekit";

// const imagekit = new ImageKit({
//   publicKey : "public_92inTOPHEeoguRfWsAbSsWKRW5A=",
//   privateKey : "private_CWTsgqd0ejvpfXdEPTPzzE7SlJ8=",
//   urlEndpoint : "https://ik.imagekit.io/zuqlyov9d"
// });

const player = videoPlayer('video', {
  imagekitId: 'YOUR_IMAGEKIT_ID',
  logo: {
    showLogo: true,
    logoImageUrl: 'https://ik.imgkit.net/ikmedia/logo/light_T4buIzohVH.svg',
    logoOnclickUrl: 'https://imagekit.io/',
  },
  // signerFn: (src: string) => {
  //   // Promisify the signing process
  //   return new Promise((resolve, reject) => {
  //     try {
  //       const imageURL = imagekit.url({
  //         src: src,
  //         queryParameters: {
  //           "v": "123"
  //         },
  //         signed: true,
  //         expireSeconds: 300
  //       });
  //       resolve(imageURL);
  //     }
  //     catch (error) {
  //       reject(error);
  //     }
  //   })
  // }
  // playbackRates: [0.5, 1, 1.5, 2]
});

const playlistManager = player.playlist([
  {
    src: 'https://ik.imagekit.io/zuqlyov9d/SEO-friendly%20file%20names.mp4',
    transformation: [
      { width: 400, height: 400 },
    ],
    chapters: { url: 'https://ik.imagekit.io/zuqlyov9d/chapters.vtt?updatedAt=1747373131804&ik-s=3757a1645bd9e6a09aed6611f58e0ab742135693' },
    // abs: { protocol: 'hls', sr: [240, 360, 720, 1080] },
    recommendations: [
      { src: 'https://ik.imagekit.io/demo/video2.mp4', info: { title: 'Next Up' } }
    ],
    shoppable: { products: [ /* … */] },
    info: { title: 'My Video', subtitle: 'Subtitle', description: 'Description' },
    poster: {
      src: 'https://ik.imagekit.io/ikmedia/docs_images/examples/Videos/example_video_2.mp4/ik-thumbnail.jpg',
      transformation: [
        { width: 400, height: 400 },
      ],
    }
  },
  {
    src: 'https://ik.imagekit.io/zuqlyov9d/SEO-friendly%20file%20names.mp4',
    transformation: [
      { width: 400, height: 400 },
    ],
    chapters: { url: 'https://ik.imagekit.io/demo/chapters_example.vtt' },
    // abs: { protocol: 'hls', sr: [240, 360, 720, 1080] },
    recommendations: [
      { src: 'https://ik.imagekit.io/demo/video2.mp4', info: { title: 'Next Up' } }
    ],
    shoppable: { products: [ /* … */] },
    info: { title: 'My Video', subtitle: 'Subtitle', description: 'Description' },
    poster: {
      src: 'https://ik.imagekit.io/demo/sample-video.mp4/ik-thumbnail.jpg',
      transformation: [
        { width: 400, height: 400 },
      ],
    }
  },
  {
    src: 'https://ik.imagekit.io/zuqlyov9d/SEO-friendly%20file%20names.mp4',
    // transformation: [
    //   { width: 400, height: 400 },
    // ],
    chapters: { url: 'https://ik.imagekit.io/demo/chapters_example.vtt' },
    abs: { protocol: 'hls', sr: [240, 360, 720, 1080] },
    recommendations: [
      { src: 'https://ik.imagekit.io/demo/video2.mp4', info: { title: 'Next Up' } }
    ],
    shoppable: { products: [ /* … */] },
    info: { title: 'My Video', subtitle: 'Subtitle', description: 'Description' },
    poster: {
      src: 'https://ik.imagekit.io/demo/sample-video.mp4/ik-thumbnail.jpg',
      transformation: [
        { width: 400, height: 400 },
      ],
    }
  },
  {
    src: 'https://ik.imagekit.io/zuqlyov9d/SEO-friendly%20file%20names.mp4',
    // transformation: [
    //   { width: 400, height: 400 },
    // ],
    chapters: { url: 'https://ik.imagekit.io/demo/chapters_example.vtt' },
    abs: { protocol: 'hls', sr: [240, 360, 720, 1080] },
    recommendations: [
      { src: 'https://ik.imagekit.io/demo/video2.mp4', info: { title: 'Next Up' } }
    ],
    shoppable: { products: [ /* … */] },
    info: { title: 'My Video', subtitle: 'Subtitle', description: 'Description' },
    poster: {
      src: 'https://ik.imagekit.io/demo/sample-video.mp4/ik-thumbnail.jpg',
      transformation: [
        { width: 400, height: 400 },
      ],
    }
  },
  {
    src: 'https://ik.imagekit.io/zuqlyov9d/SEO-friendly%20file%20names.mp4',
    // transformation: [
    //   { width: 400, height: 400 },
    // ],
    chapters: { url: 'https://ik.imagekit.io/demo/chapters_example.vtt' },
    abs: { protocol: 'hls', sr: [240, 360, 720, 1080] },
    recommendations: [
      { src: 'https://ik.imagekit.io/demo/video2.mp4', info: { title: 'Next Up' } }
    ],
    shoppable: { products: [ /* … */] },
    info: { title: 'My Video', subtitle: 'Subtitle', description: 'Description' },
    poster: {
      src: 'https://ik.imagekit.io/demo/sample-video.mp4/ik-thumbnail.jpg',
      transformation: [
        { width: 400, height: 400 },
      ],
    }
  },
  {
    src: 'https://ik.imagekit.io/zuqlyov9d/SEO-friendly%20file%20names.mp4',
    // transformation: [
    //   { width: 400, height: 400 },
    // ],
    chapters: { url: 'https://ik.imagekit.io/demo/chapters_example.vtt' },
    abs: { protocol: 'hls', sr: [240, 360, 720, 1080] },
    recommendations: [
      { src: 'https://ik.imagekit.io/demo/video2.mp4', info: { title: 'Next Up' } }
    ],
    shoppable: { products: [ /* … */] },
    info: { title: 'My Video', subtitle: 'Subtitle', description: 'Description' },
    poster: {
      src: 'https://ik.imagekit.io/demo/sample-video.mp4/ik-thumbnail.jpg',
      transformation: [
        { width: 400, height: 400 },
      ],
    }
  },
  {
    src: 'https://ik.imagekit.io/zuqlyov9d/SEO-friendly%20file%20names.mp4',
    // transformation: [
    //   { width: 400, height: 400 },
    // ],
    chapters: { url: 'https://ik.imagekit.io/demo/chapters_example.vtt' },
    abs: { protocol: 'hls', sr: [240, 360, 720, 1080] },
    recommendations: [
      { src: 'https://ik.imagekit.io/demo/video2.mp4', info: { title: 'Next Up' } }
    ],
    shoppable: { products: [ /* … */] },
    info: { title: 'My Video', subtitle: 'Subtitle', description: 'Description' },
    poster: {
      src: 'https://ik.imagekit.io/demo/sample-video.mp4/ik-thumbnail.jpg',
      transformation: [
        { width: 400, height: 400 },
      ],
    }
  }
], {
  autoAdvance: 1,
  repeat: true,
  presentUpcoming: 10,
  widgetProps: { direction: 'vertical', logoImageUrl: '…' }
})

Manager.loadFirstItem();

// player.on('playlistchange', () => {
//   console.log("playlist changed")
//   console.log(" player.src()", player.src())
// })

// player.addRemoteTextTrack({
//   src: 'https://ik.imagekit.io/zuqlyov9d/chapters.vtt?updatedAt=1747368893148&ik-s=d4ee6d4ab959139bdd4c75fae974b4bf3719d0de',
//   kind: 'chapters',
//   label: 'Chapters',
//   srclang: 'en',
// }, false);


// player.src(
//   {
//     src: 'https://ik.imagekit.io/zuqlyov9d/SEO-friendly%20file%20names.mp4',
//     transformation: [
//       // { rotation: 90, height: 400 },
//       // { width: 400, height: 400 },
//       // { rotations: 90 },
//       // { raw: 'h-400,w-400' },
//       {
//         raw: 'rt-90',
//       }
//     ],
//     chapters: { url: 'https://ik.imagekit.io/zuqlyov9d/chapters.vtt' },
//     abs: { protocol: 'hls', sr: [240, 360, 720, 1080] },
//     recommendations: [
//       {
//         src: 'https://ik.imagekit.io/ikmedia/docs_images/examples/Videos/example_video_2.mp4', info: {
//           title: 'Next Up',
//           subtitle: 'Subtitle that is a little long', 
//           description: 'A very long description that will be truncated if it is too long. A very long description that will be truncated if it is too long. A very long description that will be truncated if it is too long. A very long description that will be truncated if it is too long.',
//         },
//         poster: {
//           src: "https://ik.imagekit.io/ikmedia/docs_images/examples/Videos/example_video_2.mp4/ik-thumbnail.jpg"
//         }
//       },
//       {
//         src: 'https://ik.imagekit.io/demo/video2.mp4', info: { title: 'Next Up' },
//         poster: {
//           src: "https://ik.imagekit.io/ikmedia/docs_images/examples/Videos/example_video_2.mp4/ik-thumbnail.jpg"
//         }
//       },
//       {
//         src: 'https://ik.imagekit.io/demo/video2.mp4', info: { title: 'Next Up' },
//         poster: {
//           src: "https://ik.imagekit.io/ikmedia/docs_images/examples/Videos/example_video_2.mp4/ik-thumbnail.jpg"
//         }
//       },
//       {
//         src: 'https://ik.imagekit.io/demo/video2.mp4', info: { title: 'Next Up' },
//         poster: {
//           src: "https://ik.imagekit.io/ikmedia/docs_images/examples/Videos/example_video_2.mp4/ik-thumbnail.jpg"
//         }
//       },
//       {
//         src: 'https://ik.imagekit.io/demo/video2.mp4', info: { title: 'Next Up' },
//         poster: {
//           src: "https://ik.imagekit.io/ikmedia/docs_images/examples/Videos/example_video_2.mp4/ik-thumbnail.jpg"
//         }
//       }
//     ],
//     shoppable: { products: [ /* … */] },
//     info: { title: 'My Video', subtitle: 'Subtitle', description: 'Description' },
//     // poster: {
//     //   src: 'https://ik.imagekit.io/ikmedia/docs_images/examples/Videos/example_video_2.mp4/ik-thumbnail.jpg',
//     //   transformation: [
//     //     { width: 400, height: 400 },
//     //   ],
//     // },
//     // textTracks: [
//     //   {
//     //       src: 'http://vjs.zencdn.net/v/oceans.vtt',
//     //       maxWords: 4,
//     //       wordHighlight: true,
//     //       default: true // Indicates whether this track is active by default
//     //     },
//     //   {
//     //         autoGenerateSubtitles: true,
//     //         maxWords: 4,
//     //         wordHighlight: true,
//     //         default: true // Indicates whether this track is active by default
//     //       }
//     // ]
//   },
// )

// player.addRemoteTextTrack({
//   src: 'http://vjs.zencdn.net/v/oceans.vtt',
//   kind: 'subtitles',
//   srclang: 'en',
//   label: 'English',
//   default: true,
// });


// player.addRemoteTextTrack({
//   src: 'http://vjs.zencdn.net/v/oceans.vtt',
//   kind: 'subtitles',
//   srclang: 'en',
//   label: 'English',
//   default: true,
// });


// player.addRemoteTextTrack({
//   src: 'http://vjs.zencdn.net/v/oceans.vtt',
//   kind: 'subtitles',
//   srclang: 'en',
//   label: 'English',
//   default: true,
// });


// player.addRemoteTextTrack({
//   autoGenerateSubtitles: true,
//   maxWords: 4,
//   wordHighlight: true,
//   default: true // Indicates whether this track is active by default
// })


// player.addRemoteTextTrack({
//   src: 'http://vjs.zencdn.net/v/oceans.vtt',
//   maxWords: 4,
//   wordHighlight: true,
//   default: true // Indicates whether this track is active by default
// })


// player.addRemoteTextTrack({
//   src: 'http://vjs.zencdn.net/v/oceans.vtt',
//   // maxWords: 4,
//   // wordHighlight: true,
//   default: true // Indicates whether this track is active by default
// })