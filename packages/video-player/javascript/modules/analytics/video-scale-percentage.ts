import { computeScalePercentages, type ScalePercentages } from '@imagekit/video-analytics-core';

export function computeVideoUpDownScalePercentages(videoEl: HTMLVideoElement | null | undefined): ScalePercentages {
  const srcW = videoEl?.videoWidth ?? 0;
  const srcH = videoEl?.videoHeight ?? 0;
  // Bail before getBoundingClientRect: it forces layout and runs on every event.
  if (srcW <= 0 || srcH <= 0) return computeScalePercentages(0, 0, 0, 0);

  const rect = videoEl?.getBoundingClientRect?.();
  const dispW = rect?.width ?? 0;
  const dispH = rect?.height ?? 0;
  if (dispW <= 0 || dispH <= 0) return computeScalePercentages(0, 0, 0, 0);

  let objectFit = 'contain';
  try {
    if (videoEl && typeof getComputedStyle === 'function') {
      const computed = getComputedStyle(videoEl).objectFit;
      if (computed) objectFit = computed;
    }
  } catch {
    // getComputedStyle unavailable; fall back to the <video> default.
  }

  return computeScalePercentages(srcW, srcH, dispW, dispH, objectFit);
}
