export {
  createAnalyticsTracker,
  type AnalyticsTrackerOptions,
  type AnalyticsTrackerHandle,
  type AnalyticsTrackerUserConfig,
  type AnalyticsIntegration,
  type MappedAnalyticsError,
} from './analytics-tracker';
export type {
  AnalyticsErrorInfo,
  AnalyticsPlayer,
  PlayerSignal,
  PlaybackSnapshot,
  PlayerUiContext,
} from './player';
export type {
  AnalyticsPlatform,
  AnalyticsClock,
  AnalyticsLifecycle,
  AnalyticsLog,
  AnalyticsLogLevel,
  AnalyticsTransport,
  DeviceContext,
  KeyValueStorage,
  LifecycleHandlers,
  SentBeacon,
} from './platform';
export type { IKAnalyticsIngestRequestV1 } from './wire-format-v1';
export { createBeaconTransport, type BeaconTransportOptions } from './transport';
export { computeScalePercentages, type ScalePercentages } from './scale';
