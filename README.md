# ImageKit.io Video Player

[![Node CI](https://img.shields.io/badge/Node-CI-blue)](https://github.com/imagekit-developer/imagekit-video-player)
[![npm version](https://img.shields.io/npm/v/@imagekit/video-player.svg)](https://www.npmjs.com/package/@imagekit/video-player)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Twitter Follow](https://img.shields.io/twitter/follow/imagekitio?style=social)](https://twitter.com/imagekitio)

## Introduction

ImageKit's video player is an advanced video player built on top of [Video.js 8.20.0](https://videojs.org/guides) delivering enhanced features for a seamless, interactive video experience. It's fully integrated with ImageKit's video delivery and transformation solution.

## Key features

- **Video transformations**: Apply ImageKit video transformations at the player level or per-video level.
- **Adaptive bitrate streaming**: Full support for HLS and MPEG-DASH with automatic generation of streaming representations.
- **Subtitles and chapters**: Easy addition of subtitles, captions, and chapter markers for better video navigation.
- **Player enhancements**: Floating player when scrolled out of view, and seek thumbnails on the progress bar.
- **Custom branding**: Add a clickable logo to brand your video player.
- **Playlists and recommendations**: Create playlists with scrollable widgets or show recommended videos when playback ends.
- **Shoppable Video**: Make videos shoppable by displaying product images alongside videos.

## Installation

You can install the SDK in your project using npm or yarn.

```bash
npm install @imagekit/video-player
```

## TypeScript support

The SDK is written in TypeScript, offering first-class TypeScript support. Enjoy excellent type safety and IntelliSense in your IDE. You can use it in your TypeScript projects without any additional configuration.

## Local development

This is a Yarn workspaces + Lerna monorepo. From the repository root:

```bash
nvm use # Use the Node version from .nvmrc
corepack enable # Enable the configured Yarn version
yarn install --immutable # Install dependencies from the lockfile
yarn build # Build all workspaces
yarn dev # Build, then run workspace dev scripts in parallel
```

Framework examples are in `examples/` (`javascript`, `react`, `vue`, and `astro`). Run one from the repository root, for example:

```bash
cd examples/react && yarn dev
```

The JavaScript example needs ImageKit credentials in a `.env` file: `IMAGEKIT_PUBLIC_KEY`, `IMAGEKIT_PRIVATE_KEY`, and `IMAGEKIT_URL_ENDPOINT`. The signer server is in `imagekit-signer-server/`; create the `.env` file there, then run:

```bash
cd imagekit-signer-server
npm install && npm run dev
```

## Documentation

Refer to the [ImageKit official documentation](https://imagekit.io/docs/video-player/overview) for more details on how to use the SDK.
