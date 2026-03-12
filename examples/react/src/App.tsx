import React, { useRef } from 'react';
import { IKVideoPlayer } from '@imagekit/video-player/react';
import type {
    IKVideoPlayerRef,
    IKPlayerOptions,
    SourceOptions,
    PlaylistOptions
} from '@imagekit/video-player/react';

import '@imagekit/video-player/styles.css';

export default function App() {
    const playerRef = useRef<IKVideoPlayerRef>(null);

    // 1) Define your ImageKit IKPlayerOptions
    const ikOptions: IKPlayerOptions = {
        imagekitId: 'YOUR_IMAGEKIT_ID',
        seekThumbnails: true,
        logo: {
            showLogo: true,
            logoImageUrl: 'https://ik.imgkit.net/ikmedia/logo/light_T4buIzohVH.svg',
            logoOnclickUrl: 'https://imagekit.io/',
        },
    };

    // 2) For a single video source (SourceOptions)
    const singleSource: SourceOptions = {
        src: 'https://ik.imagekit.io/demo/sample-video.mp4',
        transformation: [
            { width: 400, height: 400 },
        ],
        chapters: true,
        info: { title: 'Bird on branch', description: 'This is a video containing bird on a branch.' }
    };

    // 3) (alternative) for a playlist of videos
    const playlist: {
        sources: SourceOptions[];
        options?: PlaylistOptions;
    } = {
        sources: [
            {
              src: "https://ik.imagekit.io/ikmedia/docs/video-player/playlist/horses.mp4",
              info: { title: "Horses Running", description: "Horses grazing in the field" },
            },
            {
              src: "https://ik.imagekit.io/ikmedia/docs/video-player/playlist/lion.mp4",
              info: {
                title: "Lion",
                description: "Lion roaming in the wild",
              },
            },
            {
              src: "https://ik.imagekit.io/ikmedia/docs/video-player/playlist/dog_running.mp4",
              info: { title: "Dog Running" },
            },
            {
              src: "https://ik.imagekit.io/ikmedia/docs/video-player/playlist/man_smiling.mp4",
              info: {
                title: "Man Smiling",
                description: "Man smiling at the camera",
              },
            },
            {
              src: "https://ik.imagekit.io/ikmedia/docs/video-player/playlist/rhino.mp4",
              info: { title: "Rhino at the zoo"},
            },
            {
              src: "https://ik.imagekit.io/demo/sample-video.mp4",
              info: { title: "Bird on branch"}
            }
          ], options: {
            autoAdvance: 1,
            repeat: true,
            presentUpcoming: 10,
            widgetProps: { direction: 'vertical' }
        }
    };

    return (
        <div>
            <IKVideoPlayer
                ref={playerRef}
                ikOptions={ikOptions}
                videoJsOptions={{
                    controls: true,
                    muted: false,
                    height: 540,
                    width: 960,
                }}
                playlist={playlist}
            />
        </div>

    );
}
