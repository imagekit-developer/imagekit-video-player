/**
 * Decoded frame size (current rendition for ABR, or file for progressive) vs painted video box (CSS px).
 * Uses the dominant axis scale (max of width/height ratios), matching typical fill/cover-style stretching.
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
  const s = Math.max(sx, sy);

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
