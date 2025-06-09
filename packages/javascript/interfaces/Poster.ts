import type { Transformation }from '@imagekit/javascript'

export interface PosterOptions {
  /** If omitted, Video.js / ImageKit generates a default thumbnail */
  src?: string;
  transformation?: Transformation[];
}
