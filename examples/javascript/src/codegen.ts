/**
 * Small helpers to ensure the "Generated Code" blocks always match the
 * actual configuration used to initialize the demo players.
 */

/**
 * Formats a JS value into a readable code string.
 * - Uses JSON.stringify with indentation
 * - Unquotes identifier-like keys
 * - Uses single quotes
 * - Supports `undefined` via a placeholder
 */
export function formatObjectAsCode(value: any): string {
  const replacer = (_key: string, val: any) => {
    if (val === undefined) return '__UNDEFINED__';
    return val;
  };

  let jsonString = JSON.stringify(value, replacer, 4);

  // Remove quotes from valid JS identifier keys
  jsonString = jsonString.replace(/"([^"]+)":/g, (_match, key) => {
    const isValidIdentifier = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key);
    return isValidIdentifier ? `${key}:` : `'${key}':`;
  });

  // Convert remaining quotes to single quotes
  jsonString = jsonString.replace(/"/g, "'");

  // Restore undefined
  jsonString = jsonString.replace(/__UNDEFINED__/g, 'undefined');

  return jsonString;
}

export function buildPlayerInitCode(params: {
  htmlHint: string;
  playerTarget: string;
  playerOptions: any;
  videoJsOptions?: any;
  afterInitLines?: string[];
}): string {
  const {
    htmlHint,
    playerTarget,
    playerOptions,
    videoJsOptions,
    afterInitLines = [],
  } = params;

  const playerOptionsCode = formatObjectAsCode(playerOptions);
  const videoJsOptionsCode = videoJsOptions
    ? `, ${formatObjectAsCode(videoJsOptions)}`
    : '';

  return `// HTML: ${htmlHint}

import { videoPlayer } from '@imagekit/video-player';
import '@imagekit/video-player/styles.css';

const player = videoPlayer('${playerTarget}', ${playerOptionsCode}${videoJsOptionsCode});
${afterInitLines.join('\n')}`.trim();
}

