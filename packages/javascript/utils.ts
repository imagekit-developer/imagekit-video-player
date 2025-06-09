// helpers.ts
import { buildSrc as ikBuild } from '@imagekit/javascript';
import type { PlayerOptions, Transformation } from './interfaces';
import type { SourceOptions } from './interfaces';
import type { ABSOptions } from './interfaces';
import { StreamingResolution } from '@imagekit/javascript/dist/interfaces';

/**
 * Take a single input (string or SourceOptions),
 * apply ABS suffix & transformations, run through signerFn if provided,
 * then build & sign the final ImageKit URL.
 */
export async function prepareSource(
  input: string | SourceOptions,
  opts: PlayerOptions
): Promise<SourceOptions> {
  // turn plain strings into a minimal SourceOptions
  let source: SourceOptions =
    typeof input === 'string' ? { src: input } : { ...input };

  // 1️⃣ Add ABS suffix + add streamingResolutions to transformation
  const { src: absSrc, transformation: absTransforms } =
    addABSSuffixToSrcURL(source, opts);
  source.src = absSrc;

  // 2️⃣ Finally build the ImageKit URL
  source.src = ikBuild({
    src: source.src,
    urlEndpoint: '',           // you could inject opts.urlEndpoint here
    transformation: absTransforms ?? [],
  });

  // 3️⃣ If they passed a signerFn, sign the built URL
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
 * Flatten whatever the integrator passed (.src could be string, object, or array)
 * into a uniform array of SourceOptions.
 */
export function normalizeInput(
  input: string | SourceOptions | Array<string | SourceOptions>
): Array<string | SourceOptions> {
  if (Array.isArray(input)) return input;
  return [input];
}


/**
 * Poll a URL until it’s ready (HTTP 200) or give up.
 *
 * @param url            The fully-built (and signed) video URL
 * @param maxTries       From PlayerOptions.maxTries
 * @param timeoutMs      From PlayerOptions.videoTimeoutInMS
 * @param fixedDelayMs   From PlayerOptions.delayInMS, or undefined for exponential
 */
export async function waitForVideoReady(
  url: string,
  maxTries: number,
  timeoutMs: number,
  fixedDelayMs?: number
): Promise<void> {
  for (let attempt = 1; attempt <= maxTries; attempt++) {
    // 1️⃣ Attempt fetch with timeout
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'HEAD',      // or "GET" if your server rejects HEAD
        signal: controller.signal
      });
    } catch (err) {
      clearTimeout(timer);
      return;
    }
    clearTimeout(timer);

    if (res.status === 202) {
      // still processing → retry
      if (attempt === maxTries) break;
      // compute delay
      const delay = fixedDelayMs != null
        ? fixedDelayMs
        : 10000 * Math.pow(2, attempt - 1);   // 10s, 20s, 40s…
      await new Promise(r => setTimeout(r, delay));
      continue;
    }
    else {
      return; // doesn't matter any other status code, we only care about 202
    }
  }

  // if we get here, we exhausted tries
  throw new Error(`Video unavailable after ${maxTries} attempts`);
}


/**
 * If ABS is configured (on the source or globally),
 * append the proper HLS/DASH suffix and push a
 * `streamingResolutions` step into the transformation.
 */
export function addABSSuffixToSrcURL(
  input: string | SourceOptions,
  opts: PlayerOptions
): { src: string; transformation: Transformation[] } {
  // start from either the input.src or string
  const baseUrl = typeof input === 'string' ? input : input.src;
  const url = new URL(baseUrl);

  // ABS can be on the per-source or global options
  const absOpts: ABSOptions | undefined =
    typeof input === 'object' && input.abs != null
      ? input.abs
      : opts.abs;

  // build a new transformation array from either input or global
  const existingTransforms: Transformation[] =
    (typeof input === 'object' && input.transformation) ? input.transformation : (opts.transformation || []);

  // if ABS is set, append the suffix and streamingResolutions
  if (absOpts) {
    if (!isTransformationAllowedWithABS(existingTransforms)) {
      throw new Error(
        'You can transform the final video using any supported video transformation parameter in ImageKit except w, h, ar, f, vc, ac, and q. '
      );
    }
    if (absOpts.protocol === 'hls') {
      url.pathname += '/ik-master.m3u8';
    } else if (absOpts.protocol === 'dash') {
      url.pathname += '/ik-master.mpd';
    }
    return {
      src: url.toString(),
      transformation: [
        ...existingTransforms,
        { streamingResolutions: absOpts.sr.map(res => res as unknown as StreamingResolution) },
      ],
    };
  }

  // no ABS at all → return original
  return {
    src: url.toString(),
    transformation: [...existingTransforms],
  };
}

/**
 * Build a poster URL for Video.js from a given video SourceOptions.
 *
 * - If no `poster` field is present on the source, generates a default thumbnail URL
 *   by swapping or appending “ik-thumbnail.jpg” to the video URL.
 * - If `input.poster.src` or `input.poster.transformation` is provided, uses that instead.
 * - Always strips any existing query string before building.
 * - Runs the final URL through ImageKit’s `buildSrc`, applying any transformations.
 * - Applies your `signerFn` if present in player options.
 *
 * @param input  The source object (must have a `.src` URL and optionally `.transformation` or `.poster`).
 * @param opts   The plugin’s global PlayerOptions (for default `transformation` and `signerFn`).
 * @returns      A fully built (and signed) poster image URL.
 */
export async function preparePosterSrc(
  input: SourceOptions,
  opts: PlayerOptions
): Promise<string> {
  // 1️⃣ Grab the raw video URL
  let videoSrcUrl = input.src;
  let posterSrcUrl: string;

  // 2️⃣ Create a URL object, so we can manipulate path vs. query cleanly
  const url = new URL(videoSrcUrl);

  // 3️⃣ Derive a “default” thumbnail path if the user didn’t supply one
  //    - If streaming suffix “ik-master.m3u8” → swap to “ik-thumbnail.jpg”
  //    - If streaming suffix “ik-master.mpd” → likewise
  //    - Otherwise append “/ik-thumbnail.jpg” after the existing path
  if (url.pathname.endsWith('ik-master.m3u8')) {
    url.pathname = url.pathname.replace(/ik-master\.m3u8$/, 'ik-thumbnail.jpg');
  } else if (url.pathname.endsWith('ik-master.mpd')) {
    url.pathname = url.pathname.replace(/ik-master\.mpd$/, 'ik-thumbnail.jpg');
  } else {
    url.pathname = `${url.pathname.replace(/\/$/, '')}/ik-thumbnail.jpg`;
  }

  // 4️⃣ Always clear any existing query parameters before building
  url.search = '';
  posterSrcUrl = url.toString();

  // 5️⃣ Run through ImageKit’s URL builder (applies any default/global transforms)
  posterSrcUrl = ikBuild({
    src: posterSrcUrl,
    urlEndpoint: '',
    transformation: input.transformation ?? opts.transformation ?? [],
  });

  // 6️⃣ If the user explicitly provided a custom poster.src or transformations, use those
  if (input.poster && (input.poster.src || input.poster.transformation)) {
    const baseVideoUrl = new URL(videoSrcUrl);
    baseVideoUrl.search = '';
    posterSrcUrl = ikBuild({
      src: input.poster.src ?? baseVideoUrl.toString(),
      urlEndpoint: '',  // same note: maybe pull from opts.urlEndpoint
      transformation: input.poster.transformation!,
    });
  }

  // 7️⃣ Finally, if the integrator passed a signerFn, sign the built URL
  if (opts.signerFn) {
    try {
      posterSrcUrl = await opts.signerFn(posterSrcUrl);
    } catch (err) {
      throw new Error(`Signing failed: ${err}`);
    }
  }

  return posterSrcUrl;
}


export async function prepareSeekThumbnailVttSrc(
  input: SourceOptions,
  opts: PlayerOptions
): Promise<string> {
  // 1️⃣ Grab the raw video URL
  let videoSrcUrl = input.src;
  let seekThumbnailVttSrc: string;

  // 2️⃣ Create a URL object, so we can manipulate path vs. query cleanly
  const url = new URL(videoSrcUrl);

  // 3️⃣ Append “/ik-seek-thumbnail-track.vtt” after the existing path
  url.pathname = `${url.pathname.replace(/\/$/, '')}/ik-seek-thumbnail-track.vtt`;


  // 4️⃣ Always clear any existing query parameters before building
  url.search = '';
  seekThumbnailVttSrc = url.toString();

  // 1️⃣ Add streamingResolutions to transformation
  const { transformation: absTransforms } =
    addABSSuffixToSrcURL(input, opts);


  // 5️⃣ Run through ImageKit’s URL builder (applies any default/global transforms)
  seekThumbnailVttSrc = ikBuild({
    src: seekThumbnailVttSrc,
    urlEndpoint: '',
    transformation: absTransforms ?? [],
  });

  // 7️⃣ Finally, if the integrator passed a signerFn, sign the built URL
  if (opts.signerFn) {
    try {
      seekThumbnailVttSrc = await opts.signerFn(seekThumbnailVttSrc);
    } catch (err) {
      throw new Error(`Signing failed: ${err}`);
    }
  }

  return seekThumbnailVttSrc;
}

export async function prepareChaptersVttSrc(
  input: SourceOptions,
  opts: PlayerOptions
): Promise<string> {
  // 1️⃣ Grab the raw video URL
  let videoSrcUrl = input.src;
  let chaptersVttSrc: string;

  // 2️⃣ Create a URL object, so we can manipulate path vs. query cleanly
  const url = new URL(videoSrcUrl);

  // 3️⃣ Add ik-genchapters.vtt suffix
  //    - If streaming suffix “ik-master.m3u8” → swap to “ik-genchapters.vtt”
  //    - If streaming suffix “ik-master.mpd” → likewise
  //    - Otherwise append “/ik-thumbnail.jpg” after the existing path
  if (url.pathname.endsWith('ik-master.m3u8')) {
    url.pathname = url.pathname.replace(/ik-master\.m3u8$/, 'ik-genchapters.vtt');
  } else if (url.pathname.endsWith('ik-master.mpd')) {
    url.pathname = url.pathname.replace(/ik-master\.mpd$/, 'ik-genchapters.vtt');
  } else {
    url.pathname = `${url.pathname.replace(/\/$/, '')}/ik-genchapters.vtt`;
  }

  // 4️⃣ Always clear any existing query parameters before building
  url.search = '';
  chaptersVttSrc = url.toString();


  // 5️⃣ Run through ImageKit’s URL builder (applies any default/global transforms)
  chaptersVttSrc = ikBuild({
    src: chaptersVttSrc,
    urlEndpoint: '',
    transformation:  [],
  });

  // 7️⃣ Finally, if the integrator passed a signerFn, sign the built URL
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
 * Returns true if none of the transformations use parameters
 * that are forbidden in ABS mode (w, h, ar, f, vc, ac, q), 
 * either via their typed properties or via a raw string.
 */
export function isTransformationAllowedWithABS(
  transformations: Transformation[]
): boolean {
  // Typed‐out properties that must not appear
  const forbiddenProps: Array<keyof Transformation> = [
    'width',
    'height',
    'aspectRatio',
    'format',
    'videoCodec',
    'audioCodec',
    'quality',
  ];

  // Regex that matches any forbidden raw‐string flag, e.g. "w-100", "ar-16-9", "q-80", etc.
  const forbiddenRaw = /\b(?:w|h|ar|f|vc|ac|q)-/;

  for (const step of transformations) {
    // 1) Check typed properties
    for (const prop of forbiddenProps) {
      if (step[prop] !== undefined) {
        return false;
      }
    }

    // 2) Check raw string, if present
    if (typeof step.raw === 'string' && forbiddenRaw.test(step.raw)) {
      return false;
    }
  }

  return true;
}

/**
 * Runtime‐validates a PlayerOptions object, ensuring all required
 * properties are present and all fields conform to their expected
 * types/ranges. Throws an Error on the first violation.
 *
 * After this call, TS will treat opts as Required<PlayerOptions>.
 */
export function validateIKPlayerOptions(
  opts: PlayerOptions
): asserts opts is Required<PlayerOptions> {
  // imagekitId: required, non‐empty string
  if (typeof opts.imagekitId !== 'string' || opts.imagekitId.trim() === '') {
    throw new Error('`imagekitId` is required and must be a non‐empty string.');
  }

  // floatingWhenNotVisible: if present, must be 'left' or 'right' or null
  if (
    opts.floatingWhenNotVisible != null &&
    opts.floatingWhenNotVisible !== 'left' &&
    opts.floatingWhenNotVisible !== 'right'
  ) {
    throw new Error("`floatingWhenNotVisible` must be 'left', 'right', or null.");
  }

  // hideContextMenu: if present, must be boolean
  if (opts.hideContextMenu != null && typeof opts.hideContextMenu !== 'boolean') {
    throw new Error('`hideContextMenu` must be a boolean.');
  }

  // logo: if present, must have all three fields
  if (opts.logo != null) {
    const { showLogo, logoImageUrl, logoOnclickUrl } = opts.logo;
    if (typeof showLogo !== 'boolean') {
      throw new Error('`logo.showLogo` must be a boolean.');
    }
    if (showLogo) {
      if (typeof logoImageUrl !== 'string' || !logoImageUrl) {
        throw new Error('`logo.logoImageUrl` must be a non‐empty string when `showLogo` is true.');
      }
      if (typeof logoOnclickUrl !== 'string' || !logoOnclickUrl) {
        throw new Error('`logo.logoOnclickUrl` must be a non‐empty string when `showLogo` is true.');
      }
    }
  }

  // seekThumbnails: if present, must be boolean
  if (opts.seekThumbnails != null && typeof opts.seekThumbnails !== 'boolean') {
    throw new Error('`seekThumbnails` must be a boolean.');
  }

  // abs: if present, must have valid protocol and sr array
  if (opts.abs != null) {
    const { protocol, sr } = opts.abs;
    if (protocol !== 'hls' && protocol !== 'dash') {
      throw new Error("`abs.protocol` must be 'hls' or 'dash'.");
    }
    if (!Array.isArray(sr) || sr.length === 0) {
      throw new Error('`abs.sr` must be a non‐empty array of numbers.');
    }
    sr.forEach((res, i) => {
      if (typeof res !== 'number' || res <= 0) {
        throw new Error(`\`abs.sr[${i}]\` must be a positive number.`);
      }
    });
  }

  // transformation: if present, must be an array
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

  // maxTries: if present, must be a positive integer
  if (
    opts.maxTries != null &&
    (!Number.isInteger(opts.maxTries) || opts.maxTries < 1)
  ) {
    throw new Error('`maxTries` must be an integer ≥ 1.');
  }

  // videoTimeoutInMS: if present, must be a non‐negative number
  if (
    opts.videoTimeoutInMS != null &&
    (typeof opts.videoTimeoutInMS !== 'number' || opts.videoTimeoutInMS < 0)
  ) {
    throw new Error('`videoTimeoutInMS` must be a number ≥ 0.');
  }

  // playedEventPercents: if present, array of numbers between 0 and 100
  if (opts.playedEventPercents != null) {
    if (!Array.isArray(opts.playedEventPercents)) {
      throw new Error('`playedEventPercents` must be an array of numbers.');
    }
    opts.playedEventPercents.forEach((p, i) => {
      if (typeof p !== 'number' || p < 0 || p > 100) {
        throw new Error(`\`playedEventPercents[${i}]\` must be between 0 and 100.`);
      }
    });
  }

  // playedEventTimes: if present, array of non‐negative numbers
  if (opts.playedEventTimes != null) {
    if (!Array.isArray(opts.playedEventTimes)) {
      throw new Error('`playedEventTimes` must be an array of numbers.');
    }
    opts.playedEventTimes.forEach((t, i) => {
      if (typeof t !== 'number' || t < 0) {
        throw new Error(`\`playedEventTimes[${i}]\` must be ≥ 0.`);
      }
    });
  }

  // delayInMS: if present, must be a non‐negative number
  if (
    opts.delayInMS != null &&
    (typeof opts.delayInMS !== 'number' || opts.delayInMS < 0)
  ) {
    throw new Error('`delayInMS` must be a number ≥ 0.');
  }

  // signerFn: if present, must be a function returning a Promise<string>
  if (opts.signerFn != null && typeof opts.signerFn !== 'function') {
    throw new Error('`signerFn` must be a function that returns a Promise<string>.');
  }
}