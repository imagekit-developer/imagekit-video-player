
import {
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { videoPlayer } from '../javascript';
import type { Player } from '../javascript';

import type { IKVideoPlayerProps, IKVideoPlayerRef } from './interfaces';

const IKVideoPlayer = forwardRef<IKVideoPlayerRef, IKVideoPlayerProps>(
  ({ ikOptions, videoJsOptions = {}, source, playlist }, ref) => {
    // React owns the container; Video.js owns the video element.
    const containerRef = useRef<HTMLDivElement | null>(null);
    const playerRef = useRef<Player | null>(null);

    useImperativeHandle(ref, () => ({
      getPlayer: () => playerRef.current,
    }));

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      // Create a fresh video element for every effect setup.
      const videoElement = document.createElement('video');
      videoElement.className = 'video-js vjs-default-skin';
      videoElement.controls = true;
      videoElement.preload = 'auto';
      container.appendChild(videoElement);

      const playerInstance = videoPlayer(
        videoElement,
        ikOptions,
        videoJsOptions
      );

      playerRef.current = playerInstance;

      if (source && playlist) {
        console.warn(
          '[IKVideoPlayer] Both `source` and `playlist` were provided. Using `playlist`.'
        );
      }

      if (
        playlist &&
        Array.isArray(playlist.sources) &&
        playlist.sources.length > 0
      ) {
        const playlistMgr = playerInstance.playlist({
          sources: playlist.sources,
          options: playlist.options || {},
        });
        playlistMgr.loadFirstItem();
      } else if (source) {
        playerInstance.src(source);
      }

      return () => {
        if (playerRef.current === playerInstance) {
          playerRef.current = null;
        }

        if (!playerInstance.isDisposed()) {
          playerInstance.dispose();
        }

        // Remove the element if Video.js hasn't already removed it.
        videoElement.parentNode?.removeChild(videoElement);
      };
    }, [ikOptions, videoJsOptions]);

    return <div ref={containerRef} />;
  }
);

export default IKVideoPlayer;
