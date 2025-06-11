import { videoPlayer } from '@imagekit/video-player';
import '@imagekit/video-player/dist/styles.css';

const player = videoPlayer('video', {
  imagekitId: 'YOUR_IMAGEKIT_ID',
  seekThumbnails: true,
  logo: {
    showLogo: true,
    logoImageUrl: 'https://ik.imgkit.net/ikmedia/logo/light_T4buIzohVH.svg',
    logoOnclickUrl: 'https://imagekit.io/',
  },
});

const playlistManager = player.playlist({
  sources: [
    {
      src: 'https://ik.imagekit.io/zuqlyov9d/SEO-friendly%20file%20names.mp4',
      transformation: [
        { width: 400, height: 400 },
      ],
      chapters: true,
      info: { title: 'Dog', subtitle: 'Dog wearing cap', description: 'This is a video containing dog wearing cap.' },
      shoppable: {
        transformation: [{ height: "300", width: "400" }],
        products: [
          {
            productId: 1,
            productName: "Sunglasses",
            highlightTime: { start: 0, end: 2 },
            imageUrl: "https://ik.imagekit.io/a1yisxurxo/women_in_red_2nd_test_L0pnP7Hb3.jpg?updatedAt=1744896751866",
            hotspots: [
              {
                time: "00:02",
                x: "50%",
                y: "50%",
                tooltipPosition: "left",
                clickUrl: "https://imagekit.io/dashboard/media-library/detail/680102eb432c476416cdd342"
              }
            ],
            onHover: {
              action: "overlay",
              args: "Click to see this product in the video"
            },
            onClick: {
              action: "seek",
              pause: 5,
              args: { time: "00:02" }
            }
          },
          {
            productId: 1,
            productName: "Sunglasses",
            highlightTime: { start: 0, end: 2 },
            imageUrl: "https://ik.imagekit.io/a1yisxurxo/women_in_red_2nd_test_L0pnP7Hb3.jpg?updatedAt=1744896751866",
            hotspots: [
              {
                time: "00:02",
                x: "50%",
                y: "50%",
                tooltipPosition: "left",
                clickUrl: "https://imagekit.io/dashboard/media-library/detail/680102eb432c476416cdd342"
              }
            ],
            onHover: {
              action: "overlay",
              args: "Click to see this product in the video"
            },
            onClick: {
              action: "seek",
              pause: 5,
              args: { time: "00:02" }
            }
          },
          {
            productId: 1,
            productName: "Hat",
            highlightTime: { start: 0, end: 2 },
            imageUrl: "https://ik.imagekit.io/a1yisxurxo/women_in_red_2nd_test_L0pnP7Hb3.jpg?updatedAt=1744896751866",
            hotspots: [
              {
                time: "00:02",
                x: "50%",
                y: "50%",
                tooltipPosition: "left",
                clickUrl: "https://imagekit.io/dashboard/media-library/detail/680102eb432c476416cdd342"
              }
            ],
            onHover: {
              action: "overlay",
              args: "Click to see this product in the video"
            },
            onClick: {
              action: "seek",
              pause: 5,
              args: { time: "00:04" }
            }
          },
          {
            productId: 1,
            productName: "Shorts",
            highlightTime: { start: 0, end: 2 },
            imageUrl: "https://ik.imagekit.io/a1yisxurxo/women_in_red_2nd_test_L0pnP7Hb3.jpg?updatedAt=1744896751866",
            hotspots: [
              {
                time: "00:02",
                x: "50%",
                y: "50%",
                tooltipPosition: "left",
                clickUrl: "https://imagekit.io/dashboard/media-library/detail/680102eb432c476416cdd342"
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
            productId: 1,
            productName: "Shorts",
            highlightTime: { start: 0, end: 2 },
            imageUrl: "https://ik.imagekit.io/a1yisxurxo/women_in_red_2nd_test_L0pnP7Hb3.jpg?updatedAt=1744896751866",
            hotspots: [
              {
                time: "00:02",
                x: "50%",
                y: "50%",
                tooltipPosition: "left",
                clickUrl: "https://imagekit.io/dashboard/media-library/detail/680102eb432c476416cdd342"
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
            productId: 1,
            productName: "Shorts",
            highlightTime: { start: 0, end: 2 },
            imageUrl: "https://ik.imagekit.io/a1yisxurxo/women_in_red_2nd_test_L0pnP7Hb3.jpg?updatedAt=1744896751866",
            hotspots: [
              {
                time: "00:02",
                x: "50%",
                y: "50%",
                tooltipPosition: "left",
                clickUrl: "https://imagekit.io/dashboard/media-library/detail/680102eb432c476416cdd342"
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
            productId: 1,
            productName: "Shorts",
            highlightTime: { start: 0, end: 2 },
            imageUrl: "https://ik.imagekit.io/a1yisxurxo/women_in_red_2nd_test_L0pnP7Hb3.jpg?updatedAt=1744896751866",
            hotspots: [
              {
                time: "00:02",
                x: "50%",
                y: "50%",
                tooltipPosition: "left",
                clickUrl: "https://imagekit.io/dashboard/media-library/detail/680102eb432c476416cdd342"
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
            productId: 1,
            productName: "Shorts",
            highlightTime: { start: 0, end: 2 },
            imageUrl: "https://ik.imagekit.io/a1yisxurxo/women_in_red_2nd_test_L0pnP7Hb3.jpg?updatedAt=1744896751866",
            hotspots: [
              {
                time: "00:02",
                x: "50%",
                y: "50%",
                tooltipPosition: "left",
                clickUrl: "https://imagekit.io/dashboard/media-library/detail/680102eb432c476416cdd342"
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
            productId: 1,
            productName: "Shorts",
            highlightTime: { start: 0, end: 2 },
            imageUrl: "https://ik.imagekit.io/a1yisxurxo/women_in_red_2nd_test_L0pnP7Hb3.jpg?updatedAt=1744896751866",
            hotspots: [
              {
                time: "00:02",
                x: "50%",
                y: "50%",
                tooltipPosition: "left",
                clickUrl: "https://imagekit.io/dashboard/media-library/detail/680102eb432c476416cdd342"
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
            productId: 1,
            productName: "Shorts",
            highlightTime: { start: 0, end: 2 },
            imageUrl: "https://ik.imagekit.io/a1yisxurxo/women_in_red_2nd_test_L0pnP7Hb3.jpg?updatedAt=1744896751866",
            hotspots: [
              {
                time: "00:02",
                x: "50%",
                y: "50%",
                tooltipPosition: "left",
                clickUrl: "https://imagekit.io/dashboard/media-library/detail/680102eb432c476416cdd342"
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
          // …two more products…
        ],
        toggleIconUrl: "https://ik.imgkit.net/ikmedia/logo/light_T4buIzohVH.svg",
        showPostPlayOverlay: true,
        autoClose: 2
      }
    },
    {
      src: 'https://ik.imagekit.io/zuqlyov9d/example_video_2.mp4',
      transformation: [
        { width: 400, height: 400 },
      ],
      chapters: true,
      info: { title: 'Human', subtitle: 'Human lying in grass', description: 'This is a video showing human lying on the grass. He is smiling.' },
      textTracks: [
        {
          autoGenerateSubtitles: true,
          maxWords: 4,
          wordHighlight: true,
          default: true // Indicates whether this track is active by default
        }]
    },
    {
      src: 'https://ik.imagekit.io/zuqlyov9d/sample-video.mp4',
      chapters: true,
      info: { title: 'Bird', subtitle: 'Bird on a branch', description: 'This video depicts bird chirping. It is sitting on a tree branch.' },
      shoppable: {
        transformation: [{ height: "300", width: "400" }],
        products: [
          {
            productId: 1,
            productName: "Sunglasses",
            highlightTime: { start: 0, end: 2 },
            imageUrl: "https://ik.imagekit.io/a1yisxurxo/women_in_red_2nd_test_L0pnP7Hb3.jpg?updatedAt=1744896751866",
            hotspots: [
              {
                time: "00:02",
                x: "50%",
                y: "50%",
                tooltipPosition: "left",
                clickUrl: "https://imagekit.io/dashboard/media-library/detail/680102eb432c476416cdd342"
              }
            ],
            onHover: {
              action: "overlay",
              args: "Click to see this product in the video"
            },
            onClick: {
              action: "seek",
              pause: 5,
              args: { time: "00:02" }
            }
          },
          {
            productId: 1,
            productName: "Sunglasses",
            highlightTime: { start: 0, end: 2 },
            imageUrl: "https://ik.imagekit.io/a1yisxurxo/women_in_red_2nd_test_L0pnP7Hb3.jpg?updatedAt=1744896751866",
            hotspots: [
              {
                time: "00:02",
                x: "50%",
                y: "50%",
                tooltipPosition: "left",
                clickUrl: "https://imagekit.io/dashboard/media-library/detail/680102eb432c476416cdd342"
              }
            ],
            onHover: {
              action: "overlay",
              args: "Click to see this product in the video"
            },
            onClick: {
              action: "seek",
              pause: 5,
              args: { time: "00:02" }
            }
          },
          {
            productId: 1,
            productName: "Hat",
            highlightTime: { start: 0, end: 2 },
            imageUrl: "https://ik.imagekit.io/a1yisxurxo/women_in_red_2nd_test_L0pnP7Hb3.jpg?updatedAt=1744896751866",
            hotspots: [
              {
                time: "00:02",
                x: "50%",
                y: "50%",
                tooltipPosition: "left",
                clickUrl: "https://imagekit.io/dashboard/media-library/detail/680102eb432c476416cdd342"
              }
            ],
            onHover: {
              action: "overlay",
              args: "Click to see this product in the video"
            },
            onClick: {
              action: "seek",
              pause: 5,
              args: { time: "00:04" }
            }
          },
          {
            productId: 1,
            productName: "Shorts",
            highlightTime: { start: 0, end: 2 },
            imageUrl: "https://ik.imagekit.io/a1yisxurxo/women_in_red_2nd_test_L0pnP7Hb3.jpg?updatedAt=1744896751866",
            hotspots: [
              {
                time: "00:02",
                x: "50%",
                y: "50%",
                tooltipPosition: "left",
                clickUrl: "https://imagekit.io/dashboard/media-library/detail/680102eb432c476416cdd342"
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
            productId: 1,
            productName: "Shorts",
            highlightTime: { start: 0, end: 2 },
            imageUrl: "https://ik.imagekit.io/a1yisxurxo/women_in_red_2nd_test_L0pnP7Hb3.jpg?updatedAt=1744896751866",
            hotspots: [
              {
                time: "00:02",
                x: "50%",
                y: "50%",
                tooltipPosition: "left",
                clickUrl: "https://imagekit.io/dashboard/media-library/detail/680102eb432c476416cdd342"
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
            productId: 1,
            productName: "Shorts",
            highlightTime: { start: 0, end: 2 },
            imageUrl: "https://ik.imagekit.io/a1yisxurxo/women_in_red_2nd_test_L0pnP7Hb3.jpg?updatedAt=1744896751866",
            hotspots: [
              {
                time: "00:02",
                x: "50%",
                y: "50%",
                tooltipPosition: "left",
                clickUrl: "https://imagekit.io/dashboard/media-library/detail/680102eb432c476416cdd342"
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
            productId: 1,
            productName: "Shorts",
            highlightTime: { start: 0, end: 2 },
            imageUrl: "https://ik.imagekit.io/a1yisxurxo/women_in_red_2nd_test_L0pnP7Hb3.jpg?updatedAt=1744896751866",
            hotspots: [
              {
                time: "00:02",
                x: "50%",
                y: "50%",
                tooltipPosition: "left",
                clickUrl: "https://imagekit.io/dashboard/media-library/detail/680102eb432c476416cdd342"
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
            productId: 1,
            productName: "Shorts",
            highlightTime: { start: 0, end: 2 },
            imageUrl: "https://ik.imagekit.io/a1yisxurxo/women_in_red_2nd_test_L0pnP7Hb3.jpg?updatedAt=1744896751866",
            hotspots: [
              {
                time: "00:02",
                x: "50%",
                y: "50%",
                tooltipPosition: "left",
                clickUrl: "https://imagekit.io/dashboard/media-library/detail/680102eb432c476416cdd342"
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
            productId: 1,
            productName: "Shorts",
            highlightTime: { start: 0, end: 2 },
            imageUrl: "https://ik.imagekit.io/a1yisxurxo/women_in_red_2nd_test_L0pnP7Hb3.jpg?updatedAt=1744896751866",
            hotspots: [
              {
                time: "00:02",
                x: "50%",
                y: "50%",
                tooltipPosition: "left",
                clickUrl: "https://imagekit.io/dashboard/media-library/detail/680102eb432c476416cdd342"
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
            productId: 1,
            productName: "Shorts",
            highlightTime: { start: 0, end: 2 },
            imageUrl: "https://ik.imagekit.io/a1yisxurxo/women_in_red_2nd_test_L0pnP7Hb3.jpg?updatedAt=1744896751866",
            hotspots: [
              {
                time: "00:02",
                x: "50%",
                y: "50%",
                tooltipPosition: "left",
                clickUrl: "https://imagekit.io/dashboard/media-library/detail/680102eb432c476416cdd342"
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
          // …two more products…
        ],
        toggleIconUrl: "https://ik.imgkit.net/ikmedia/logo/light_T4buIzohVH.svg",
        showPostPlayOverlay: true,
        autoClose: 2
      }
    },
    {
      src: 'https://ik.imagekit.io/zuqlyov9d/SEO-friendly%20file%20names.mp4',
      transformation: [
        { width: 400, height: 400 },
      ],
      chapters: true,
      info: { title: 'Dog 2', subtitle: 'Dog wearing cap', description: 'This is a video containing dog wearing cap.' },
      // shoppable: {
      //   transformation: [{ height: "300", width: "400" }],
      //   products: [
      //     {
      //       productId: 1,
      //       productName: "Sunglasses",
      //       highlightTime: { start: 0, end: 2 },
      //       imageUrl: "https://ik.imagekit.io/a1yisxurxo/women_in_red_2nd_test_L0pnP7Hb3.jpg?updatedAt=1744896751866",
      //       hotspots: [
      //         {
      //           time: "00:02",
      //           x: "50%",
      //           y: "50%",
      //           tooltipPosition: "left",
      //           clickUrl: "https://imagekit.io/dashboard/media-library/detail/680102eb432c476416cdd342"
      //         }
      //       ],
      //       onHover: {
      //         action: "overlay",
      //         args: "Click to see this product in the video"
      //       },
      //       onClick: {
      //         action: "seek",
      //         pause: 5,
      //         args: { time: "00:02" }
      //       }
      //     },
      //     {
      //       productId: 1,
      //       productName: "Sunglasses",
      //       highlightTime: { start: 0, end: 2 },
      //       imageUrl: "https://ik.imagekit.io/a1yisxurxo/women_in_red_2nd_test_L0pnP7Hb3.jpg?updatedAt=1744896751866",
      //       hotspots: [
      //         {
      //           time: "00:02",
      //           x: "50%",
      //           y: "50%",
      //           tooltipPosition: "left",
      //           clickUrl: "https://imagekit.io/dashboard/media-library/detail/680102eb432c476416cdd342"
      //         }
      //       ],
      //       onHover: {
      //         action: "overlay",
      //         args: "Click to see this product in the video"
      //       },
      //       onClick: {
      //         action: "seek",
      //         pause: 5,
      //         args: { time: "00:02" }
      //       }
      //     },
      //     {
      //       productId: 1,
      //       productName: "Hat",
      //       highlightTime: { start: 0, end: 2 },
      //       imageUrl: "https://ik.imagekit.io/a1yisxurxo/women_in_red_2nd_test_L0pnP7Hb3.jpg?updatedAt=1744896751866",
      //       hotspots: [
      //         {
      //           time: "00:02",
      //           x: "50%",
      //           y: "50%",
      //           tooltipPosition: "left",
      //           clickUrl: "https://imagekit.io/dashboard/media-library/detail/680102eb432c476416cdd342"
      //         }
      //       ],
      //       onHover: {
      //         action: "overlay",
      //         args: "Click to see this product in the video"
      //       },
      //       onClick: {
      //         action: "seek",
      //         pause: 5,
      //         args: { time: "00:04" }
      //       }
      //     },
      //     {
      //       productId: 1,
      //       productName: "Shorts",
      //       highlightTime: { start: 0, end: 2 },
      //       imageUrl: "https://ik.imagekit.io/a1yisxurxo/women_in_red_2nd_test_L0pnP7Hb3.jpg?updatedAt=1744896751866",
      //       hotspots: [
      //         {
      //           time: "00:02",
      //           x: "50%",
      //           y: "50%",
      //           tooltipPosition: "left",
      //           clickUrl: "https://imagekit.io/dashboard/media-library/detail/680102eb432c476416cdd342"
      //         }
      //       ],
      //       onHover: {
      //         action: "overlay",
      //         args: "Click to see this product in the video"
      //       },
      //       onClick: {
      //         action: "seek",
      //         pause: 5,
      //         args: { time: "00:06" }
      //       }
      //     },
      //     // …two more products…
      //   ],
      //   toggleIconUrl: "https://ik.imgkit.net/ikmedia/logo/light_T4buIzohVH.svg"
      // }
    },
    {
      src: 'https://ik.imagekit.io/zuqlyov9d/SEO-friendly%20file%20names.mp4',
      transformation: [
        { width: 400, height: 400 },
      ],
      chapters: true,
      info: { title: 'Dog 3', subtitle: 'Dog wearing cap', description: 'This is a video containing dog wearing cap.' },
      // shoppable: {
      //   transformation: [{ height: "300", width: "400" }],
      //   products: [
      //     {
      //       productId: 1,
      //       productName: "Sunglasses",
      //       highlightTime: { start: 0, end: 2 },
      //       imageUrl: "https://ik.imagekit.io/a1yisxurxo/women_in_red_2nd_test_L0pnP7Hb3.jpg?updatedAt=1744896751866",
      //       hotspots: [
      //         {
      //           time: "00:02",
      //           x: "50%",
      //           y: "50%",
      //           tooltipPosition: "left",
      //           clickUrl: "https://imagekit.io/dashboard/media-library/detail/680102eb432c476416cdd342"
      //         }
      //       ],
      //       onHover: {
      //         action: "overlay",
      //         args: "Click to see this product in the video"
      //       },
      //       onClick: {
      //         action: "seek",
      //         pause: 5,
      //         args: { time: "00:02" }
      //       }
      //     },
      //     {
      //       productId: 1,
      //       productName: "Sunglasses",
      //       highlightTime: { start: 0, end: 2 },
      //       imageUrl: "https://ik.imagekit.io/a1yisxurxo/women_in_red_2nd_test_L0pnP7Hb3.jpg?updatedAt=1744896751866",
      //       hotspots: [
      //         {
      //           time: "00:02",
      //           x: "50%",
      //           y: "50%",
      //           tooltipPosition: "left",
      //           clickUrl: "https://imagekit.io/dashboard/media-library/detail/680102eb432c476416cdd342"
      //         }
      //       ],
      //       onHover: {
      //         action: "overlay",
      //         args: "Click to see this product in the video"
      //       },
      //       onClick: {
      //         action: "seek",
      //         pause: 5,
      //         args: { time: "00:02" }
      //       }
      //     },
      //     {
      //       productId: 1,
      //       productName: "Hat",
      //       highlightTime: { start: 0, end: 2 },
      //       imageUrl: "https://ik.imagekit.io/a1yisxurxo/women_in_red_2nd_test_L0pnP7Hb3.jpg?updatedAt=1744896751866",
      //       hotspots: [
      //         {
      //           time: "00:02",
      //           x: "50%",
      //           y: "50%",
      //           tooltipPosition: "left",
      //           clickUrl: "https://imagekit.io/dashboard/media-library/detail/680102eb432c476416cdd342"
      //         }
      //       ],
      //       onHover: {
      //         action: "overlay",
      //         args: "Click to see this product in the video"
      //       },
      //       onClick: {
      //         action: "seek",
      //         pause: 5,
      //         args: { time: "00:04" }
      //       }
      //     },
      //     {
      //       productId: 1,
      //       productName: "Shorts",
      //       highlightTime: { start: 0, end: 2 },
      //       imageUrl: "https://ik.imagekit.io/a1yisxurxo/women_in_red_2nd_test_L0pnP7Hb3.jpg?updatedAt=1744896751866",
      //       hotspots: [
      //         {
      //           time: "00:02",
      //           x: "50%",
      //           y: "50%",
      //           tooltipPosition: "left",
      //           clickUrl: "https://imagekit.io/dashboard/media-library/detail/680102eb432c476416cdd342"
      //         }
      //       ],
      //       onHover: {
      //         action: "overlay",
      //         args: "Click to see this product in the video"
      //       },
      //       onClick: {
      //         action: "seek",
      //         pause: 5,
      //         args: { time: "00:06" }
      //       }
      //     },
      //     // …two more products…
      //   ],
      //   toggleIconUrl: "https://ik.imgkit.net/ikmedia/logo/light_T4buIzohVH.svg"
      // }
    },
  ], options: {
    autoAdvance: false,
    repeat: true,
    presentUpcoming: 10,
    widgetProps: { direction: 'vertical' }
  }
})

player.on(['loadstart'], () => {
  console.log('loadstart fired');
});

player.on(['loadedmetadata'], () => {
console.log('Metadata loaded');
});

player.on(['loadeddata'], () => {
console.log('data loaded fired');
});

playlistManager.loadFirstItem();