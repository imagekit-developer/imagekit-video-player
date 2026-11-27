// Transport for v1 analytics ingest: gzip → base64url → GET ?d=…&z=<g|r>.
import Foundation

/// Base64url-encode bytes (RFC 4648 §5, no padding).
private func base64urlEncode(_ bytes: Data) -> String {
    let b64 = bytes.base64EncodedString()
    var out = b64.replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_")
    while out.hasSuffix("=") { out.removeLast() }
    return out
}

private func utf8Bytes(_ s: String) -> Data {
    Data(s.utf8)
}

package struct SendGetOptions: Sendable {
    package var keepalive: Bool
}

package struct BeaconTransportOptions: Sendable {
    /// Gzips UTF-8 text. Omit when the host has no gzip; payloads are then sent uncompressed.
    package var gzip: (@Sendable (String) async throws -> Data)?
    /// Fire-and-forget GET; the response is never read. `keepalive` is set only for
    /// unload-time flushes, where the request must outlive the app teardown.
    package var sendGet: @Sendable (String, SendGetOptions) async throws -> Void

    package init(
        gzip: (@Sendable (String) async throws -> Data)? = nil,
        sendGet: @escaping @Sendable (String, SendGetOptions) async throws -> Void
    ) {
        self.gzip = gzip
        self.sendGet = sendGet
    }
}

@MainActor
package func createBeaconTransport(_ options: BeaconTransportOptions) -> any AnalyticsTransport {
    BeaconTransport(options)
}

@MainActor
private final class BeaconTransport: AnalyticsTransport {
    private let gzip: (@Sendable (String) async throws -> Data)?
    private let sendGet: @Sendable (String, SendGetOptions) async throws -> Void

    var supportsCompression: Bool {
        gzip != nil
    }

    init(_ options: BeaconTransportOptions) {
        gzip = options.gzip
        sendGet = options.sendGet
    }

    private func compress(_ json: String) async -> Data? {
        guard let gzip else { return nil }
        do {
            return try await gzip(json)
        } catch {
            return nil
        }
    }

    func send(
        _ req: IKAnalyticsIngestRequestV1,
        options opts: AnalyticsSendOptions,
        completion: @escaping @MainActor (Result<SentBeacon, any Error>) -> Void
    ) {
        let ingestUrl = opts.ingestUrl
        let json: String
        do {
            json = try jsonStringify(req.jsonObject)
        } catch {
            completion(.failure(error))
            return
        }
        let isUnloadFlush = req.r == FlushReason.pagehide.rawValue
            || req.r == FlushReason.visibilityHidden.rawValue
            || req.r == FlushReason.dispose.rawValue
        let sendGet = sendGet
        Task {
            let jsonUtf8 = utf8Bytes(json)
            let gzipped = await compress(json)
            let payload = gzipped ?? jsonUtf8
            let encodingTag = gzipped != nil ? "g" : "r"

            let b64url = base64urlEncode(payload)
            let sep = ingestUrl.contains("?") ? "&" : "?"
            let url = "\(ingestUrl)\(sep)d=\(b64url)&z=\(encodingTag)"
            do {
                try await sendGet(url, SendGetOptions(keepalive: isUnloadFlush))
                completion(.success(SentBeacon(jsonBytes: jsonUtf8.count, urlBytes: url.utf16.count, gzipped: gzipped != nil)))
            } catch {
                completion(.failure(error))
            }
        }
    }
}
