import type Player from 'video.js/dist/types/player';
import { createAnalyticsTracker as createCoreAnalyticsTracker } from '@imagekit/video-analytics-core';
import type { CleanupRegistry } from '../../utils';
import type { SourceOptions, RawPlayerError, MappedError, ReportableError } from '../../interfaces';
import { browserPlatform } from './browser-platform';
import { createVideoJsAnalyticsPlayer } from './player-adapter';
import { version as PLUGIN_VERSION } from '../../../package.json';

const PLUGIN_NAME = 'imagekit-video-player';

export interface AnalyticsTrackerUserConfig {
  userId?: string;
  customDimensions?: Record<string, string>;
  debug?: boolean;
  mapError?: (error: RawPlayerError) => MappedError | undefined | null;
}

export interface AnalyticsTrackerOptions {
  config: AnalyticsTrackerUserConfig;
  imagekitId: string;
  player: Player;
  getCurrentSource: () => SourceOptions | null;
  /** Identifies the current source for video-change detection: its URL before signing. */
  getSourceKey: () => string;
  cleanup: CleanupRegistry;
  pageLoadStartMonotonic?: number;
}

export interface AnalyticsTrackerHandle {
  /**
   * Manually report an error into the analytics pipeline without changing
   * player state. Goes through `mapError` like a native player error.
   */
  reportError(error: ReportableError): void;
  setCustomDimensions(dims: Record<string, string>): void;
  getCustomDimensions(): Record<string, string>;
}

export function createAnalyticsTracker(options: AnalyticsTrackerOptions): AnalyticsTrackerHandle {
  const { config, imagekitId, player, getCurrentSource, getSourceKey, cleanup, pageLoadStartMonotonic } = options;
  const tracker = createCoreAnalyticsTracker({
    config,
    imagekitId,
    player: createVideoJsAnalyticsPlayer(player, getCurrentSource, getSourceKey),
    platform: browserPlatform,
    integration: { name: PLUGIN_NAME, version: PLUGIN_VERSION },
    initMonotonicMs: pageLoadStartMonotonic ?? (typeof performance !== 'undefined' ? performance.now() : 0),
  });
  cleanup.register(() => tracker.dispose());
  return {
    reportError: (error) => tracker.reportError(error),
    setCustomDimensions: (dims) => tracker.setCustomDimensions(dims),
    getCustomDimensions: () => tracker.getCustomDimensions(),
  };
}
