import { buildSrc as ikBuild } from '@imagekit/javascript';
import type { IKPlayerOptions, Transformation } from './interfaces';
import type { SourceOptions } from './interfaces';
import type { ABSOptions } from './interfaces';
import { StreamingResolution } from '@imagekit/javascript/dist/interfaces';

const HLS_MASTER_SUFFIX = 'ik-master.m3u8';
const DASH_MASTER_SUFFIX = 'ik-master.mpd';
const THUMBNAIL_SUFFIX = 'ik-thumbnail.jpg';

const ALLOWED_TRANSFORM_PARAMS_CHAPTERS = new Set(['so', 'eo', 'du']);

/**
 * Filters the 'tr' query parameter to only include allowed transformation parameters.
 * Handles chained transformations (separated by :) and normal transformations (separated by ,).
 * @param url - The URL to filter
 * @param allowedParams - Set of allowed transformation parameter names
 * @returns The same URL object with filtered tr parameter (mutated in place)
 */
export function filterTrQueryParam(url: URL, allowedParams: ReadonlySet<string>): void {
  const transformationString = url.searchParams.get('tr');
  if (transformationString) {
    const filteredChains = transformationString.split(':').map(chain => {
      // Split each chain by comma to get individual transformation params
      const filteredParams = chain.split(',').filter(param => {
        // Extract the key (part before the first '-')
        const key = param.split('-')[0];
        return allowedParams.has(key);
      });
      return filteredParams.join(',');
    }).filter(chain => chain.length > 0);
    
    if (filteredChains.length > 0) {
      url.searchParams.set('tr', filteredChains.join(':'));
    } else {
      url.searchParams.delete('tr');
    }
  }
}
/**
 * Prepares a video source by applying ABS suffix, transformations, and signing.
 * @param input - String URL or SourceOptions object
 * @param opts - ImageKit player options
 * @returns Prepared SourceOptions with built and signed URL
 */
export async function prepareSource(
  input: string | SourceOptions,
  opts: IKPlayerOptions
): Promise<SourceOptions> {
  let source: SourceOptions =
    typeof input === 'string' ? { src: input } : { ...input };

  const { src: finalSrc, transformation: finalTransformations } =
    resolveSourceUrlAndTransformations(source, opts);

  source.src = ikBuild({
    src: finalSrc,
    urlEndpoint: '',
    transformation: finalTransformations,
  });

  if (opts.signerFn) {
    try {
      source.src = await opts.signerFn(source.src);
    } catch (err) {
      throw new Error(`Signing failed: ${err}`);
    }
  }

  return source;
}

/**
 * Normalizes input into a uniform array format.
 * @param input - String, SourceOptions, or array of either
 * @returns Array of string or SourceOptions
 */
export function normalizeInput(
  input: string | SourceOptions | Array<string | SourceOptions>
): Array<string | SourceOptions> {
  if (Array.isArray(input)) return input;
  return [input];
}


/**
 * Polls a URL until the video is ready or max attempts are reached.
 * @param url - The fully-built and signed video URL
 * @param maxTries - Maximum number of polling attempts
 * @param timeoutMs - Request timeout in milliseconds
 * @param fixedDelayMs - Fixed delay between attempts, or undefined for exponential backoff
 */
export async function waitForVideoReady(
  url: string,
  maxTries: number,
  timeoutMs: number,
  fixedDelayMs?: number
): Promise<void> {
  for (let attempt = 1; attempt <= maxTries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal
      });
    } catch (err) {
      clearTimeout(timer);
      return;
    }
    clearTimeout(timer);

    const parsedUrl = new URL(res.url);
    if (res.redirected && parsedUrl.searchParams.has('tr') && parsedUrl.searchParams.get('tr') === 'orig') {
      if (attempt === maxTries) break;
      const delay = fixedDelayMs != null
        ? fixedDelayMs
        : 10000 * Math.pow(2, attempt - 1);
      await new Promise(r => setTimeout(r, delay));
      continue;
    } else {
      return;
    }
  }

  throw new Error(`Video unavailable after ${maxTries} attempts`);
}


/**
 * Resolves the final source URL and transformations from input and options.
 * Handles ABS configuration (adds suffix and streamingResolutions) and determines final transformations.
 * @param input - String URL or SourceOptions
 * @param opts - ImageKit player options
 * @returns Object with modified src URL and final transformation array
 */
export function resolveSourceUrlAndTransformations(
  input: string | SourceOptions,
  opts: IKPlayerOptions
): { src: string; transformation: Transformation[] } {
  const baseUrl = typeof input === 'string' ? input : input.src;
  const url = new URL(baseUrl);

  const absOpts: ABSOptions | undefined =
    typeof input === 'object' && input.abs != null
      ? input.abs
      : opts.abs;

  const existingTransforms: Transformation[] =
    (typeof input === 'object' && input.transformation) ? input.transformation : (opts.transformation || []);
  
  let finalTransformations: Transformation[] = existingTransforms;

  if (absOpts) {
    if (!isTransformationAllowedWithABS(existingTransforms)) {
      throw new Error(
        'You can transform the final video using any supported video transformation parameter in ImageKit except w, h, ar, f, vc, ac, and q.'
      );
    }
    if (absOpts.protocol === 'hls') {
      url.pathname += `/${HLS_MASTER_SUFFIX}`;
    } else if (absOpts.protocol === 'dash') {
      url.pathname += `/${DASH_MASTER_SUFFIX}`;
    }

    finalTransformations = [...existingTransforms, { streamingResolutions: absOpts.sr.map(res => res as unknown as StreamingResolution) }];
  }

  if(finalTransformations.length > 0 && url.searchParams.get('tr') !== null) {
    url.searchParams.delete('tr');
  }

  return {
    src: url.toString(),
    transformation: finalTransformations,
  };
}

/**
 * Builds a poster URL from a video source.
 * Generates default thumbnail URL if no poster is provided, or uses custom poster if specified.
 * @param input - Source options with video URL
 * @param opts - ImageKit player options
 * @returns Fully built and signed poster image URL
 */
export async function preparePosterSrc(
  input: SourceOptions,
  opts: IKPlayerOptions
): Promise<string> {
  let videoSrcUrl = input.src;
  let posterSrcUrl: string;

  const url = new URL(videoSrcUrl);

  if (url.pathname.endsWith(HLS_MASTER_SUFFIX)) {
    url.pathname = url.pathname.replace(new RegExp(`${HLS_MASTER_SUFFIX}$`), THUMBNAIL_SUFFIX);
  } else if (url.pathname.endsWith(DASH_MASTER_SUFFIX)) {
    url.pathname = url.pathname.replace(new RegExp(`${DASH_MASTER_SUFFIX}$`), THUMBNAIL_SUFFIX);
  } else {
    url.pathname = `${url.pathname.replace(/\/$/, '')}/${THUMBNAIL_SUFFIX}`;
  }

  posterSrcUrl = url.toString();

  if (input.poster && (input.poster.src || input.poster.transformation)) {
    const baseVideoUrl = new URL(videoSrcUrl);
    if(baseVideoUrl.searchParams.get('tr') !== null) {
      baseVideoUrl.searchParams.delete('tr');
    }
    posterSrcUrl = ikBuild({
      src: input.poster.src ?? baseVideoUrl.toString() + `/${THUMBNAIL_SUFFIX}`,
      urlEndpoint: '',
      transformation: input.poster.transformation!,
    });
  }

  if (opts.signerFn) {
    try {
      posterSrcUrl = await opts.signerFn(posterSrcUrl);
    } catch (err) {
      throw new Error(`Signing failed: ${err}`);
    }
  }

  return posterSrcUrl;
}


/**
 * Builds a seek thumbnail VTT URL from a video source.
 * @param input - Source options with video URL
 * @param opts - ImageKit player options
 * @returns Fully built and signed seek thumbnail VTT URL
 */
export async function prepareSeekThumbnailVttSrc(
  input: SourceOptions,
  opts: IKPlayerOptions
): Promise<string> {
  let videoSrcUrl = input.src;
  let seekThumbnailVttSrc: string;

  const url = new URL(videoSrcUrl);
  url.pathname = `${url.pathname.replace(/\/$/, '')}/ik-seek-thumbnail-track.vtt`;
  seekThumbnailVttSrc = url.toString();

  if (opts.signerFn) {
    try {
      seekThumbnailVttSrc = await opts.signerFn(seekThumbnailVttSrc);
    } catch (err) {
      throw new Error(`Signing failed: ${err}`);
    }
  }

  return seekThumbnailVttSrc;
}

/**
 * Builds a chapters VTT URL from a video source.
 * @param input - Source options with video URL
 * @param opts - ImageKit player options
 * @returns Fully built and signed chapters VTT URL
 */
export async function prepareChaptersVttSrc(
  input: SourceOptions,
  opts: IKPlayerOptions
): Promise<string> {
  let videoSrcUrl = input.src;
  let chaptersVttSrc: string;

  const url = new URL(videoSrcUrl);

  if (url.pathname.endsWith(HLS_MASTER_SUFFIX)) {
    url.pathname = url.pathname.replace(new RegExp(`${HLS_MASTER_SUFFIX}$`), 'ik-genchapter.vtt');
  } else if (url.pathname.endsWith(DASH_MASTER_SUFFIX)) {
    url.pathname = url.pathname.replace(new RegExp(`${DASH_MASTER_SUFFIX}$`), 'ik-genchapter.vtt');
  } else {
    url.pathname = `${url.pathname.replace(/\/$/, '')}/ik-genchapter.vtt`;
  }

  filterTrQueryParam(url, ALLOWED_TRANSFORM_PARAMS_CHAPTERS);

  chaptersVttSrc = ikBuild({
    src: url.toString(),
    urlEndpoint: '',
    transformation: [],
  });

  if (opts.signerFn) {
    try {
      chaptersVttSrc = await opts.signerFn(chaptersVttSrc);
    } catch (err) {
      throw new Error(`Signing failed: ${err}`);
    }
  }

  return chaptersVttSrc;
}

/**
 * Checks if transformations are allowed with ABS mode.
 * Forbidden parameters: width, height, aspectRatio, format, videoCodec, audioCodec, quality.
 * @param transformations - Array of transformation objects to validate
 * @returns True if all transformations are allowed with ABS
 */
export function isTransformationAllowedWithABS(
  transformations: Transformation[]
): boolean {
  const forbiddenProps: Array<keyof Transformation> = [
    'width',
    'height',
    'aspectRatio',
    'format',
    'videoCodec',
    'audioCodec',
    'quality',
  ];

  const forbiddenRaw = /\b(?:w|h|ar|f|vc|ac|q)-/;

  for (const step of transformations) {
    for (const prop of forbiddenProps) {
      if (step[prop] !== undefined) {
        return false;
      }
    }

    if (typeof step.raw === 'string' && forbiddenRaw.test(step.raw)) {
      return false;
    }
  }

  return true;
}

/**
 * Runtime-validates IKPlayerOptions, ensuring all properties conform to expected types/ranges.
 * Throws an Error on the first violation.
 * @param opts - ImageKit player options to validate
 */
export function validateIKPlayerOptions(
  opts: IKPlayerOptions
): asserts opts is Required<IKPlayerOptions> {
  if (typeof opts.imagekitId !== 'string' || opts.imagekitId.trim() === '') {
    throw new Error('`imagekitId` is required and must be a non-empty string.');
  }

  if (
    opts.floatingWhenNotVisible != null &&
    opts.floatingWhenNotVisible !== 'left' &&
    opts.floatingWhenNotVisible !== 'right'
  ) {
    throw new Error("`floatingWhenNotVisible` must be 'left', 'right', or null.");
  }

  if (opts.hideContextMenu != null && typeof opts.hideContextMenu !== 'boolean') {
    throw new Error('`hideContextMenu` must be a boolean.');
  }

  if (opts.logo != null) {
    const { showLogo, logoImageUrl, logoOnclickUrl } = opts.logo;
    if (typeof showLogo !== 'boolean') {
      throw new Error('`logo.showLogo` must be a boolean.');
    }
    if (showLogo) {
      if (typeof logoImageUrl !== 'string' || !logoImageUrl) {
        throw new Error('`logo.logoImageUrl` must be a non-empty string when `showLogo` is true.');
      }
      if (typeof logoOnclickUrl !== 'string' || !logoOnclickUrl) {
        throw new Error('`logo.logoOnclickUrl` must be a non-empty string when `showLogo` is true.');
      }
    }
  }

  if (opts.seekThumbnails != null && typeof opts.seekThumbnails !== 'boolean') {
    throw new Error('`seekThumbnails` must be a boolean.');
  }

  if (opts.abs != null) {
    const { protocol, sr } = opts.abs;
    if (protocol !== 'hls' && protocol !== 'dash') {
      throw new Error("`abs.protocol` must be 'hls' or 'dash'.");
    }
    if (!Array.isArray(sr) || sr.length === 0) {
      throw new Error('`abs.sr` must be a non-empty array of numbers.');
    }
    sr.forEach((res, i) => {
      if (typeof res !== 'number' || res <= 0) {
        throw new Error(`\`abs.sr[${i}]\` must be a positive number.`);
      }
    });
  }

  if (
    opts.transformation != null &&
    !Array.isArray(opts.transformation)
  ) {
    throw new Error('`transformation` must be an array of Transformation objects.');
  }

  if (opts.transformation && opts.abs) {
    if (!isTransformationAllowedWithABS(opts.transformation)) {
      throw new Error(
        'You can transform the final video using any supported video transformation parameter in ImageKit except w, h, ar, f, vc, ac, and q.'
      );
    }
  }

  if (
    opts.maxTries != null &&
    (!Number.isInteger(opts.maxTries) || opts.maxTries < 1)
  ) {
    throw new Error('`maxTries` must be an integer ≥ 1.');
  }

  if (
    opts.videoTimeoutInMS != null &&
    (typeof opts.videoTimeoutInMS !== 'number' || opts.videoTimeoutInMS < 0)
  ) {
    throw new Error('`videoTimeoutInMS` must be a number ≥ 0.');
  }

  if (
    opts.delayInMS != null &&
    (typeof opts.delayInMS !== 'number' || opts.delayInMS < 0)
  ) {
    throw new Error('`delayInMS` must be a number ≥ 0.');
  }

  if (opts.signerFn != null && typeof opts.signerFn !== 'function') {
    throw new Error('`signerFn` must be a function that returns a Promise<string>.');
  }
}

/**
 * Adds an event listener to an element and returns a cleanup function to remove it.
 * This pattern helps prevent memory leaks by making cleanup explicit.
 * 
 * @param element - The DOM element to attach the listener to
 * @param eventName - The event name (e.g., 'click', 'mouseenter', 'keydown')
 * @param handler - The event handler function
 * @param options - Optional AddEventListenerOptions (capture, once, passive, etc.)
 * @returns A cleanup function that removes the event listener when called
 * 
 * @example
 * ```typescript
 * const cleanup = addEventListener(button, 'click', handleClick);
 * // Later, when done:
 * cleanup(); // Removes the listener
 * ```
 */
export function addEventListener(
  element: EventTarget,
  eventName: string,
  handler: EventListenerOrEventListenerObject,
  options?: boolean | AddEventListenerOptions
): () => void {
  element.addEventListener(eventName, handler, options ?? false);
  
  return () => {
    element.removeEventListener(eventName, handler, options ?? false);
  };
}

/**
 * Resource cleanup registry for managing timeouts, intervals, DOM elements,
 * event listeners, and other resources that need cleanup.
 * 
 * This class provides a centralized way to track and dispose of resources,
 * preventing memory leaks by ensuring all resources are properly cleaned up.
 * 
 * @example
 * ```typescript
 * const cleanup = new CleanupRegistry();
 * 
 * // Register a timeout
 * cleanup.registerTimeout(() => console.log('done'), 1000);
 * 
 * // Register a DOM element
 * const el = cleanup.registerElement(document.createElement('div'));
 * 
 * // Register an event listener
 * cleanup.registerEventListener(button, 'click', handler);
 * 
 * // Later, clean up everything at once
 * cleanup.dispose();
 * ```
 */
export class CleanupRegistry {
  private cleanups: Array<() => void> = [];

  /**
   * Registers a timeout and returns its ID.
   * The timeout will be automatically cleared when dispose() is called.
   */
  registerTimeout(callback: () => void, delay: number): ReturnType<typeof setTimeout> {
    const id = setTimeout(callback, delay);
    this.cleanups.push(() => clearTimeout(id));
    return id;
  }

  /**
   * Registers an interval and returns its ID.
   * The interval will be automatically cleared when dispose() is called.
   */
  registerInterval(callback: () => void, delay: number): ReturnType<typeof setInterval> {
    const id = setInterval(callback, delay);
    this.cleanups.push(() => clearInterval(id));
    return id;
  }

  /**
   * Registers a DOM element for cleanup.
   * The element will be removed from the DOM when dispose() is called.
   */
  registerElement(element: HTMLElement): HTMLElement {
    this.cleanups.push(() => element.remove());
    return element;
  }

  /**
   * Registers a native event listener using the addEventListener utility.
   * The listener will be automatically removed when dispose() is called.
   */
  registerEventListener(
    element: EventTarget,
    eventName: string,
    handler: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): void {
    const cleanup = addEventListener(element, eventName, handler, options);
    this.cleanups.push(cleanup);
  }

  /**
   * Registers a Video.js event listener.
   * The listener will be automatically removed when dispose() is called.
   */
  registerVideoJsListener(player: any, event: string, handler: Function): void {
    player.on(event, handler);
    this.cleanups.push(() => player.off(event, handler));
  }

  /**
   * Registers an IntersectionObserver.
   * The observer will be disconnected when dispose() is called.
   */
  registerObserver(observer: IntersectionObserver): IntersectionObserver {
    this.cleanups.push(() => observer.disconnect());
    return observer;
  }

  /**
   * Registers a custom cleanup function.
   * Useful for any other cleanup operations that don't fit the above patterns.
   */
  register(cleanup: () => void): void {
    this.cleanups.push(cleanup);
  }

  /**
   * Executes all registered cleanup functions and clears the registry.
   * Should be called when the component/plugin is being disposed.
   */
  dispose(): void {
    this.cleanups.forEach(cleanup => cleanup());
    this.cleanups = [];
  }

  /**
   * Returns the number of registered cleanup functions.
   * Useful for debugging.
   */
  size(): number {
    return this.cleanups.length;
  }
}