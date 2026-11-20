export interface ScalePercentages {
  video_upscale_percentage: number;
  video_downscale_percentage: number;
}

const NO_SCALE: ScalePercentages = { video_upscale_percentage: 0, video_downscale_percentage: 0 };

/**
 * Decoded frame size (current rendition for ABR, or file for progressive) vs painted video box.
 *
 * The scale factor actually applied to the pixels depends on how the frame is fitted
 * (CSS `object-fit` on web; `videoGravity` / `resizeMode` on native map onto the same set):
 *  - `contain` (default): uniform scale that fits the frame inside the box and letterboxes
 *    the other axis -> min(sx, sy).
 *  - `cover`: uniform scale that fills the box and crops the overflow -> max(sx, sy).
 *  - `fill`: non-uniform stretch, each axis scaled independently; reported as the
 *    larger-magnitude distortion -> max(sx, sy).
 *  - `none` / `scale-down` at native size: pixels painted 1:1 -> scale 1 (no up/down).
 */
export function computeScalePercentages(
  sourceWidth: number,
  sourceHeight: number,
  displayWidth: number,
  displayHeight: number,
  fit: string = 'contain'
): ScalePercentages {
  if (sourceWidth <= 0 || sourceHeight <= 0) return { ...NO_SCALE };
  if (displayWidth <= 0 || displayHeight <= 0) return { ...NO_SCALE };

  const sx = displayWidth / sourceWidth;
  const sy = displayHeight / sourceHeight;

  let s: number;
  switch (fit) {
    case 'cover':
    case 'fill':
      s = Math.max(sx, sy);
      break;
    case 'none':
      s = 1;
      break;
    case 'scale-down':
      s = Math.min(1, Math.min(sx, sy));
      break;
    case 'contain':
    default:
      s = Math.min(sx, sy);
      break;
  }

  if (!isFinite(s) || s <= 0) return { ...NO_SCALE };

  if (s >= 1) {
    return { video_upscale_percentage: Math.round((s - 1) * 100), video_downscale_percentage: 0 };
  }
  return { video_upscale_percentage: 0, video_downscale_percentage: Math.round((1 - s) * 100) };
}
