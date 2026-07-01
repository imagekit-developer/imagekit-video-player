/**
 * Decoded frame size (current rendition for ABR, or file for progressive) vs painted video box (CSS px).
 *
 * The scale factor actually applied to the pixels depends on the element's CSS `object-fit`,
 * so we read it at measurement time rather than assuming one mode:
 *  - `contain` (the browser default for <video>, used by this player): uniform scale that fits
 *    the frame inside the box and letterboxes the other axis -> min(sx, sy).
 *  - `cover`: uniform scale that fills the box and crops the overflow -> max(sx, sy).
 *  - `fill`: non-uniform stretch, each axis scaled independently; reported as the larger-magnitude
 *    distortion -> max(sx, sy).
 *  - `none` / `scale-down` at native size: pixels painted 1:1 -> scale 1 (no up/down).
 */
export function computeVideoUpDownScalePercentages(videoEl: HTMLVideoElement | null | undefined): {
  video_upscale_percentage: number;
  video_downscale_percentage: number;
} {
  const srcW = videoEl?.videoWidth ?? 0;
  const srcH = videoEl?.videoHeight ?? 0;
  if (srcW <= 0 || srcH <= 0) {
    return { video_upscale_percentage: 0, video_downscale_percentage: 0 };
  }

  const rect = videoEl?.getBoundingClientRect?.();
  const dispW = rect?.width ?? 0;
  const dispH = rect?.height ?? 0;
  if (dispW <= 0 || dispH <= 0) {
    return { video_upscale_percentage: 0, video_downscale_percentage: 0 };
  }

  const sx = dispW / srcW;
  const sy = dispH / srcH;

  // Determine the applied scale based on the painted element's object-fit.
  let objectFit = 'contain'; // <video> browser default
  try {
    if (videoEl && typeof getComputedStyle === 'function') {
      const computed = getComputedStyle(videoEl).objectFit;
      if (computed) objectFit = computed;
    }
  } catch {
    // getComputedStyle unavailable (non-DOM env); fall back to contain.
  }

  let s: number;
  switch (objectFit) {
    case 'cover':
      s = Math.max(sx, sy);
      break;
    case 'fill':
      s = Math.max(sx, sy); // non-uniform; report the larger-magnitude distortion
      break;
    case 'none':
      s = 1; // painted at native size, no scaling
      break;
    case 'scale-down': {
      // Equivalent to the smaller of `none` and `contain`: never upscales.
      const contain = Math.min(sx, sy);
      s = Math.min(1, contain);
      break;
    }
    case 'contain':
    default:
      s = Math.min(sx, sy);
      break;
  }

  if (!isFinite(s) || s <= 0) {
    return { video_upscale_percentage: 0, video_downscale_percentage: 0 };
  }

  if (s >= 1) {
    return {
      video_upscale_percentage: Math.round((s - 1) * 100),
      video_downscale_percentage: 0,
    };
  }

  return {
    video_upscale_percentage: 0,
    video_downscale_percentage: Math.round((1 - s) * 100),
  };
}
