import {
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { videoPlayer } from '../javascript';

import type { IKVideoPlayerProps, IKVideoPlayerRef } from './interfaces';

const IKVideoPlayer = forwardRef<IKVideoPlayerRef, IKVideoPlayerProps>(
  (
    { ikOptions, videoJsOptions = {}, source, playlist, className, style },
    ref
  ) => {
    // A ref to the actual <video> element
    const videoRef = useRef<HTMLVideoElement | null>(null);
    // A ref to hold the Video.js player instance once initialized
    const playerRef = useRef<any | null>(null);

    // Expose getPlayer() to parent components
    useImperativeHandle(ref, () => ({
      getPlayer: () => playerRef.current,
    }));

    useEffect(() => {
      // If there was already a player, dispose it before re-creating
      if (playerRef.current) {
        playerRef.current.dispose();
        playerRef.current = null;
      }

      // Ensure our <video> DOM node is present
      if (!videoRef.current) return;

      // Initialize Video.js via the helper from '@imagekit/video-player'
      const playerInstance = videoPlayer(
        videoRef.current,
        ikOptions,
        videoJsOptions
      );
      playerRef.current = playerInstance;

      // If both source and playlist are provided, warn and pick playlist
      if (source && playlist) {
        console.warn(
          '[IKVideoPlayer] Both `source` and `playlist` were provided. Using `playlist`.'
        );
      }

      // Apply playlist if given
      if (
        playlist &&
        Array.isArray(playlist.sources) &&
        playlist.sources.length > 0
      ) {
        // @ts-ignore
        const playlistMgr = playerInstance.playlist({
          sources: playlist.sources,
          options: playlist.options || {},
        });
        playlistMgr.loadFirstItem();
      } else if (source) {
        // Otherwise, set a single source
        playerInstance.src(source);
      }

      // Clean up when component unmounts
      return () => {
        if (playerRef.current) {
          playerRef.current.dispose();
          playerRef.current = null;
        }
      };
      // We intentionally do not re-run on `source` or `playlist` changes
      // If you need runtime updates, add a separate effect for that.
    }, [ikOptions, videoJsOptions]);

    return (
      <video
        ref={videoRef}
        className={`video-js ${className || ''}`}
        style={style}
        controls
        preload="auto"
      />
    );
  }
);

export default IKVideoPlayer;