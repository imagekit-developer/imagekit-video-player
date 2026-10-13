# Changelog

## [1.0.0-beta.6]

- Fixed the quality menu showing two checkmarks after a rendition change: the selection now follows the user's choice (manual rendition or Auto) instead of the rendition currently playing
- Fixed manual rendition changes waiting for an already-downloaded segment to finish before switching to the new rendition
- Fixed caption settings selects being unreadable under host CSS resets
- Native Video.js `html5` options passed via `videoJsOptions` are now respected (`nativeTextTracks` is still forced to `false`)

## [1.0.0-beta.5]

- Added playback analytics (QoE) tracking: enable via `analytics.enabled`

## [1.0.0-beta.4]

- Added support for Astro, by exporting component from `@imagekit/video-player/astro`

## [1.0.0-beta.3]

- Changed licensce to Apache-2.0

## [1.0.0-beta.2]

- Fix poster source URL handling

## [1.0.0-beta.1]

- Video player with adaptive streaming (HLS/DASH)
- Playlist support with chapters, subtitles, and shoppable features
- Chapter markers with translation support
- Subtitle highlight color customization
- Shoppable panel overlay
- Browser/IIFE, ESM, and CJS bundle support
