/**
 * Transport for v1 analytics ingest: gzip → base64url → GET ?d=… with keepalive.
 * One code path for every flush reason (interval, buffer_full, size_limit, visibility_hidden, pagehide, dispose, manual).
 */
import type { IKAnalyticsIngestRequestV1 } from './wire-format-v1';

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

/** UTF-8 encode a string to a Uint8Array. */
function utf8Bytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

/** Gzip a string via native CompressionStream. Returns null when unsupported. */
async function gzipString(s: string): Promise<Uint8Array | null> {
  const CS: typeof CompressionStream | undefined =
    (globalThis as unknown as { CompressionStream?: typeof CompressionStream }).CompressionStream;
  if (!CS) return null;
  try {
    const input = utf8Bytes(s);
    const stream = new Blob([input]).stream().pipeThrough(new CS('gzip'));
    const buf = await new Response(stream).arrayBuffer();
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

export interface SendBatchOptions {
  ingestUrl: string;
  debug?: boolean;
}

/**
 * Send a v1 batch as `GET ingestUrl?d=<base64url(gzip(json))>`.
 * Uses `fetch` with `keepalive: true` so unload-time flushes still ship.
 * Falls back to uncompressed payload on the rare browsers without CompressionStream.
 */
export async function sendBatchV1(
  req: IKAnalyticsIngestRequestV1,
  opts: SendBatchOptions
): Promise<void> {
  const { ingestUrl, debug } = opts;
  const json = JSON.stringify(req);

  let payload: Uint8Array | null = await gzipString(json);
  let encodingTag = 'g';

  if (!payload) {
    payload = utf8Bytes(json);
    encodingTag = 'r';
    if (debug) {
      console.warn('[IK Analytics] CompressionStream unavailable; sending uncompressed payload');
    }
  }

  try {
    const b64url = base64urlEncode(payload);
    const sep = ingestUrl.includes('?') ? '&' : '?';
    const url = `${ingestUrl}${sep}d=${b64url}&z=${encodingTag}`;

    if (debug) {
      console.log(
        '[IK Analytics] GET batch',
        req.r,
        req.e.length,
        'events',
        'urlBytes:', url.length
      );
    }

    // `keepalive` is only needed for unload-time flushes so the request survives
    // the page tearing down. Using it for routine flushes counts against Chrome's
    // 64 KB per-origin keepalive quota and can cause silent failures (which Chrome
    // mis-labels as "CORS error" in DevTools).
    //
    // `mode: 'no-cors'` is safe here because the beacon is fire-and-forget — we
    // never read the response. This avoids any CORS surface (including preflights
    // if/when we add custom headers later).
    const isUnloadFlush =
      req.r === 'pagehide' || req.r === 'visibility_hidden' || req.r === 'dispose';
    await fetch(url, {
      method: 'GET',
      keepalive: isUnloadFlush,
      credentials: 'omit',
      mode: 'no-cors',
    });
  } catch (err) {
    if (debug) console.warn('[IK Analytics] Flush failed', err);
  }
}
