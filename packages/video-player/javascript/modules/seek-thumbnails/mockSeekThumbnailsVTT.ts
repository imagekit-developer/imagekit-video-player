/**
 * Frontend VTT fetch interceptor: rewrites the VTT fetch URL to a default VTT you provide.
 *
 * Usage:
 *   // call early in your app or demo entrypoint
 *   import { initVttRedirect } from './mockSeekThumbnailsVTT';
 *   initVttRedirect('https://my.cdn.com/default-thumbnails.vtt');
 */
export function initVttRedirect(defaultVttUrl: string) {
    const originalFetch = window.fetch.bind(window);
  
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      let requestUrl: string;
      if (typeof input === 'string') {
        requestUrl = input;
      } else if (input instanceof URL) {
        requestUrl = input.toString();
      } else if (input instanceof Request) {
        requestUrl = input.url;
      } else {
        // fallback
        return originalFetch(input, init);
      }
  
      // match the VTT endpoint (with or without query)
      const vttPattern = /https:\/\/ik\.imagekit\.io\/zuqlyov9d\/example_video_2\.mp4\/ik-seek-thumbnail-track\.vtt(\?.*)?$/;
      if (vttPattern.test(requestUrl)) {
        // redirect to the provided default VTT URL
        return originalFetch(defaultVttUrl, init);
      }
  
      // otherwise, proceed normally
      return originalFetch(input, init);
    };
  }
  