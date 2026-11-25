package struct ScalePercentages: Equatable, Sendable {
    package var videoUpscalePercentage: Double
    package var videoDownscalePercentage: Double

    package init(videoUpscalePercentage: Double, videoDownscalePercentage: Double) {
        self.videoUpscalePercentage = videoUpscalePercentage
        self.videoDownscalePercentage = videoDownscalePercentage
    }
}

private let noScale = ScalePercentages(videoUpscalePercentage: 0, videoDownscalePercentage: 0)

/// Decoded frame size (current rendition for ABR, or file for progressive) vs painted video box.
///
/// The scale factor actually applied to the pixels depends on how the frame is fitted
/// (CSS `object-fit` on web; `videoGravity` / `resizeMode` on native map onto the same set):
///  - `contain` (default): uniform scale that fits the frame inside the box and letterboxes
///    the other axis -> min(sx, sy).
///  - `cover`: uniform scale that fills the box and crops the overflow -> max(sx, sy).
///  - `fill`: non-uniform stretch, each axis scaled independently; reported as the
///    larger-magnitude distortion -> max(sx, sy).
///  - `none` / `scale-down` at native size: pixels painted 1:1 -> scale 1 (no up/down).
package func computeScalePercentages(
    _ sourceWidth: Double,
    _ sourceHeight: Double,
    _ displayWidth: Double,
    _ displayHeight: Double,
    fit: String = "contain"
) -> ScalePercentages {
    if sourceWidth <= 0 || sourceHeight <= 0 { return noScale }
    if displayWidth <= 0 || displayHeight <= 0 { return noScale }

    let sx = displayWidth / sourceWidth
    let sy = displayHeight / sourceHeight

    let s: Double
    switch fit {
    case "cover", "fill":
        s = Swift.max(sx, sy)
    case "none":
        s = 1
    case "scale-down":
        s = Swift.min(1, Swift.min(sx, sy))
    default:
        s = Swift.min(sx, sy)
    }

    if !s.isFinite || s <= 0 { return noScale }

    if s >= 1 {
        return ScalePercentages(videoUpscalePercentage: jsRound((s - 1) * 100), videoDownscalePercentage: 0)
    }
    return ScalePercentages(videoUpscalePercentage: 0, videoDownscalePercentage: jsRound((1 - s) * 100))
}
