/**
 * Transport for v1 analytics ingest: gzip → base64url → GET ?d=…&z=<g|r>.
 */
import type { IKAnalyticsIngestRequestV1 } from './wire-format-v1';
import type { AnalyticsTransport, SentBeacon } from './platform';

/** Base64url-encode a byte array (RFC 4648 §5, no padding). */
function base64urlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  if (typeof btoa === 'undefined') {
    throw new Error('[IK Analytics] base64 encoder (btoa) unavailable');
  }
  const b64 = btoa(bin);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function utf8Bytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

export interface BeaconTransportOptions {
  /** Gzips UTF-8 text. Omit when the host has no gzip; payloads are then sent uncompressed. */
  gzip?: (text: string) => Promise<Uint8Array>;
  /**
   * Fire-and-forget GET; the response is never read. `keepalive` is set only for
   * unload-time flushes, where the request must outlive the page/app teardown.
   */
  sendGet: (url: string, options: { keepalive: boolean }) => Promise<unknown>;
}

export function createBeaconTransport(options: BeaconTransportOptions): AnalyticsTransport {
  const { gzip, sendGet } = options;

  async function compress(json: string): Promise<Uint8Array | null> {
    if (!gzip) return null;
    try {
      return await gzip(json);
    } catch {
      return null;
    }
  }

  async function send(req: IKAnalyticsIngestRequestV1, opts: { ingestUrl: string }): Promise<SentBeacon> {
    const { ingestUrl } = opts;
    const json = JSON.stringify(req);
    const jsonUtf8 = utf8Bytes(json);
    const gzipped = await compress(json);
    const payload = gzipped ?? jsonUtf8;
    const encodingTag = gzipped ? 'g' : 'r';

    const b64url = base64urlEncode(payload);
    const sep = ingestUrl.includes('?') ? '&' : '?';
    const url = `${ingestUrl}${sep}d=${b64url}&z=${encodingTag}`;
    const isUnloadFlush = req.r === 'pagehide' || req.r === 'visibility_hidden' || req.r === 'dispose';
    await sendGet(url, { keepalive: isUnloadFlush });
    return { jsonBytes: jsonUtf8.length, urlBytes: url.length, gzipped: !!gzipped };
  }

  return { supportsCompression: !!gzip, send };
}
