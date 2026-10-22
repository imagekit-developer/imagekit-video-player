# Changelog

## [1.0.0-beta.6]

- Fixed the quality menu showing two checkmarks after a rendition change: the selection now follows the user's choice (manual rendition or Auto) instead of the rendition currently playing
- Fixed the quality menu keeping the previous source's renditions (and logging an error on click) after switching from an HLS/DASH source to a progressive one
- Fixed manual rendition changes waiting for an already-downloaded segment to finish before switching to the new rendition
- Fixed caption settings selects being unreadable under host CSS resets
- Native Video.js `html5` options passed via `videoJsOptions` are now respected (`nativeTextTracks` is still forced to `false`)
- Accessibility (WCAG 2.1 AA): shoppable, recommendations, playlist, "Up next", context menu, floating player and logo now work with the keyboard and screen readers, with one visible focus ring and AA contrast in both skins
- Auto-advance now shows a cancellable "Up next in N" countdown. Recommendations and the shoppable post-play screen appear only if the viewer cancels it (previously they showed briefly before the next video)
- Light skin (`video-js-skin-light`) now covers the control bar, menus and big play button
- The focus ring follows `--color-accent`; new CSS tokens `--color-focus-ring` and `--color-focus-edge`
- Added `logo.logoAltText`, `kind: 'descriptions'` text tracks, and `upnextstart` / `upnextend` / `upnextcancel` events
- Keyboard shortcuts no longer catch Ctrl / Cmd / Alt combinations or keys pressed on the player's own controls
- Fixed stale recommendations showing over the next video, and an extra skip when choosing a playlist item during auto-advance
- Audio description: text descriptions only for now; described audio tracks are not supported yet

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
