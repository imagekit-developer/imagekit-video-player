import React, { useRef } from 'react';
import {
    IKVideoPlayer,
} from '@imagekit/video-player/react';

import type {
    IKVideoPlayerRef
} from '@imagekit/video-player/react';

import {
    PlayerOptions,
    SourceOptions,
    PlaylistOptions
} from '@imagekit/video-player'

export default function App() {
    const playerRef = useRef<IKVideoPlayerRef>(null);

    // 1) Define your ImageKit PlayerOptions
    const ikOptions: PlayerOptions = {
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
        src: 'https://ik.imagekit.io/zuqlyov9d/SEO-friendly%20file%20names.mp4',
        transformation: [
            { width: 400, height: 400 },
        ],
        chapters: true,
        info: { title: 'Dog', subtitle: 'Dog wearing cap', description: 'This is a video containing dog wearing cap.' }
    };

    // 3) (alternative) for a playlist of videos
    const playlist: {
        sources: SourceOptions[];
        options?: PlaylistOptions;
    } = {
        sources: [
            {
                src: 'https://ik.imagekit.io/zuqlyov9d/SEO-friendly%20file%20names.mp4',
                transformation: [
                    { width: 400, height: 400 },
                ],
                chapters: true,
                info: { title: 'Dog', subtitle: 'Dog wearing cap', description: 'This is a video containing dog wearing cap.' }
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
            },
        ], options: {
            autoAdvance: 1,
            repeat: true,
            presentUpcoming: 10,
            widgetProps: { direction: 'vertical' }
        }
    };

    // Handler to demonstrate how to grab the raw player instance
    const onLogCurrentTime = () => {
        const player = playerRef.current?.getPlayer();
        if (player) {
            console.log('Current time:', player.currentTime());
            player.play(); // you can call any Video.js method
        }
    };

    return (
        <div style={{ maxWidth: 800, margin: '2rem auto' }}>
            <h1>ImageKit Video Player (React) Example</h1>

            <button onClick={onLogCurrentTime}>
                Log current time & ensure player is playing
            </button>

            <div style={{ marginTop: '1rem' }}>
                <IKVideoPlayer
                    ref={playerRef}
                    ikOptions={ikOptions}
                    videoJsOptions={{
                        controls: true,
                        fluid: true,
                        muted: false
                    }}
                    // Only one of `source` or `playlist` should be set:
                    playlist={playlist}
                    // playlist={playlist}
                    className="my-custom-player-container"
                    style={{ width: '100%' }}
                />
            </div>
        </div>
    );
}
