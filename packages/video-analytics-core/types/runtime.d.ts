// The core compiles without the DOM lib so browser-only APIs fail type-checking.
// These are the only host globals it may use; all exist in browsers, Node, Hermes and JavaScriptCore.
// Timers go through `AnalyticsClock.schedule`.
declare function btoa(data: string): string;
declare class TextEncoder {
  encode(input?: string): Uint8Array;
}
