// The URLs the player builds for a source (video or stream, poster, seek
// thumbnails, chapters, AI subtitles and translations), available without
// loading the player or video.js. Pass the source through prepareSource first:
// the other builders derive their URLs from the prepared one.
export {
  prepareSource,
  preparePosterSrc,
  prepareSeekThumbnailVttSrc,
  prepareChaptersVttSrc,
  prepareSubtitleSrc,
} from './utils';
export type { IKPlayerOptions, SourceOptions, RemoteTextTrackOptions } from './interfaces';
