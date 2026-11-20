// The core compiles without the DOM lib so browser-only APIs fail type-checking.
// These are the only host globals it may use; all exist in browsers, Node, Hermes and JavaScriptCore.
declare function setInterval(handler: () => void, timeout?: number): unknown;
declare function clearInterval(id: unknown): void;
declare function setTimeout(handler: () => void, timeout?: number): unknown;
declare function btoa(data: string): string;
declare class TextEncoder {
  encode(input?: string): Uint8Array;
}
