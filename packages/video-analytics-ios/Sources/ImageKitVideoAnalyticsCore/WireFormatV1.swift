// V1 analytics wire format: positional event rows + short context keys.
// Mirror copy lives in video-analytics-ingest-server/internal/wire.
// Field order and key map MUST stay in lockstep with that file and wire-format-v1.ts.
//
// Design notes:
//  - `orientation` and `video_source_hostname` are derived server-side from video_source_url + w/h.
//  - `error_context` is truncated to 512 B at encode time.
import Foundation

package let wireVersion = 1

/// Ordered positions for an event row on the wire.
/// Trailing nulls are trimmed by encoder; decoder pads missing positions with null.
/// NEVER reorder or insert; only append (and bump `wireVersion` for breaking changes).
package let eventFieldsV1: [String] = [
    "event_time",                  // 0  — ms epoch (number)
    "event_order",                 // 1
    "event_id",                    // 2
    "event",                       // 3  — IKAnalyticsEventName
    "previous_event",              // 4
    "ms_from_previous_event",      // 5
    "playback_id",                 // 6
    "video_source_url",            // 7
    "video_source_type",           // 8
    "video_width_pixels",          // 9
    "video_height_pixels",         // 10
    "video_total_duration_ms",     // 11
    "playback_time_instant_ms",    // 12
    "playing_time_ms",             // 13
    "video_upscale_percentage",    // 14
    "video_downscale_percentage",  // 15
    "from_position_ms",            // 16
    "to_position_ms",              // 17
    "seek_time_ms",                // 18
    "bitrate",                     // 19
    "played_delta_ms",             // 20
    "rebuffer_duration_ms",        // 21
    "error_code",                  // 22
    "error_message",               // 23
    "view_end_reason",             // 24
    "new_video_source_url",        // 25
    "next_playback_id",            // 26
    "video_startup_time_ms",       // 27
    "player_startup_time_ms",      // 28
    "page_load_time_ms",           // 29
    "audio_codec",                 // 30
    "video_codec",                 // 31
    "error_context",               // 32
    "previous_playback_id",        // 33  — predecessor playback (videochange or warm resume)
    "previous_session_id",         // 34  — predecessor session (warm resume only; gates startup-time MVs server-side)
]

/// Short-key → canonical context field.
package let contextKeyMapV1: [String: String] = [
    "ik": "imagekit_id",
    "s": "session_id",
    "p": "player_instance_id",
    "u": "user_id",
    "url": "page_url",
    "dw": "device_display_width",
    "dh": "device_display_height",
    "dpr": "device_display_dpr",
    "ua": "user_agent",
    "ssd": "session_start_date",
    "sst": "session_start_time_iso",
    "psw": "player_software",
    "psv": "player_software_version",
    "ip": "imagekit_plugin",
    "ipv": "imagekit_plugin_version",
    "pw": "player_width_pixels",
    "ph": "player_height_pixels",
    "pa": "player_autoplay",
    "pp": "player_preload",
    // Custom dimensions object keyed by slot code: `{ cd_1: value, cd_2: value }`.
    // Slots are allocated per tenant in the dashboard; the ingest server stores
    // each entry verbatim in the ClickHouse Map column.
    "cd": "custom_dimensions",
    "wd": "webdriver",
]

/// Canonical → short-key (inverse of `contextKeyMapV1`).
package let contextKeyMapV1Inverse: [String: String] = Dictionary(
    uniqueKeysWithValues: contextKeyMapV1.map { ($0.value, $0.key) }
)

/// Wire-format envelope (what's gzipped + base64url-encoded into ?d=).
package struct IKAnalyticsIngestRequestV1 {
    package var v: Int
    /// batch_id
    package var b: String
    /// sent_at ms epoch
    package var t: Double
    /// flush_reason
    package var r: String
    /// context (short keys)
    package var c: [String: Any]
    /// positional event rows, trailing nulls trimmed
    package var e: [[Any]]

    /// The envelope as a `JSONSerialization` object.
    package var jsonObject: [String: Any] {
        ["v": v, "b": b, "t": jsonNumber(t), "r": r, "c": c, "e": e]
    }
}

package struct JSONStringifyError: Error {}

/// `JSON.stringify` for the objects the core builds (`jsonNumber` numbers, strings, bools, `NSNull`,
/// arrays and string-keyed dictionaries).
package func jsonStringify(_ value: Any) throws -> String {
    guard JSONSerialization.isValidJSONObject(value) else { throw JSONStringifyError() }
    let data = try JSONSerialization.data(withJSONObject: value, options: [.withoutEscapingSlashes])
    guard let json = String(data: data, encoding: .utf8) else { throw JSONStringifyError() }
    return json
}

/// A number as `JSON.stringify` writes it. `JSONSerialization` writes a `Double` with up to 17
/// significant digits (0.1 as 0.10000000000000001) and -0 as -0; JS writes the shortest round-trip
/// form, which `Double.description` also produces. Non-finite numbers become null.
package func jsonNumber(_ x: Double) -> Any {
    if !x.isFinite { return NSNull() }
    if x == x.rounded(.towardZero), abs(x) < 9e15 { return Int(x) }
    if abs(x) >= 1e-6, abs(x) < 1e21 {
        return NSDecimalNumber(string: x.description, locale: Locale(identifier: "en_US_POSIX"))
    }
    return x
}

/// Truncates to at most `maxBytes` of UTF-8, cutting only between characters and appending `…`
/// (3 bytes) when truncated. Sizes are computed from UTF-16 code units, as in TS.
package func truncateBytes(_ s: String?, _ maxBytes: Int) -> String? {
    guard let s else { return nil }
    let units = Array(s.utf16)
    let keepBytes = maxBytes - 3
    var bytes = 0
    var cut = 0
    var i = 0
    while i < units.count {
        let code = units[i]
        var size = code < 0x80 ? 1 : code < 0x800 ? 2 : 3
        let next: UInt16? = i + 1 < units.count ? units[i + 1] : nil
        let isSurrogatePair = code >= 0xD800 && code <= 0xDBFF && next.map { $0 >= 0xDC00 && $0 <= 0xDFFF } == true
        if isSurrogatePair { size = 4 }
        bytes += size
        if bytes > maxBytes { return String(decoding: units[0..<cut], as: UTF16.self) + "…" }
        if isSurrogatePair { i += 1 }
        if bytes <= keepBytes { cut = i + 1 }
        i += 1
    }
    return s
}

/// Encode canonical context into short-key wire shape, dropping undefined values.
@MainActor
package func encodeContextV1(_ context: IKAnalyticsClientContext) -> [String: Any] {
    var out: [String: Any] = [:]
    for (longKey, value) in context.entries() {
        guard let value else { continue }
        let shortKey = contextKeyMapV1Inverse[longKey] ?? longKey
        out[shortKey] = (value as? Double).map(jsonNumber) ?? value
    }
    return out
}

/// From the file extension of the URL path; manifests without one (e.g. `manifest(format=…)`) are `other`.
func deriveVideoSourceType(_ url: String) -> VideoSourceType {
    let path = String(url.prefix { $0 != "?" && $0 != "#" }).lowercased()
    if path.hasSuffix(".m3u8") { return .hls }
    if path.hasSuffix(".mpd") { return .dash }
    if path.hasSuffix(".mp4") { return .mp4 }
    if path.hasSuffix(".webm") { return .webm }
    return .other
}

private let eventTimeIndex = eventFieldsV1.firstIndex(of: "event_time")!
private let videoSourceTypeIndex = eventFieldsV1.firstIndex(of: "video_source_type")!
private let errorMessageIndex = eventFieldsV1.firstIndex(of: "error_message")!
private let errorContextIndex = eventFieldsV1.firstIndex(of: "error_context")!

/// Encodes one event into its positional row, trailing nulls trimmed.
package func encodeEventRowV1(_ event: AnalyticsEvent, _ eventTimeMs: Double) -> [Any] {
    var row: [Any] = eventFieldsV1.map { field in
        let value = event.wireValue(field)
        if value == nil || (value as? String) == "" { return NSNull() }
        return value!
    }
    row[eventTimeIndex] = eventTimeMs.isFinite ? eventTimeMs.rounded(.towardZero) : NSNull()
    if let url = event.videoSourceUrl, !url.isEmpty { row[videoSourceTypeIndex] = deriveVideoSourceType(url).rawValue }
    row[errorMessageIndex] = truncateBytes(nonEmpty(event.errorMessage), 256) ?? NSNull()
    row[errorContextIndex] = truncateBytes(nonEmpty(event.errorContext), 512) ?? NSNull()

    var len = row.count
    while len > 0, row[len - 1] is NSNull { len -= 1 }
    row.removeSubrange(len...)
    // After trimming: like JS, a NaN position is kept by the trim and written as null.
    return row.map { ($0 as? Double).map(jsonNumber) ?? $0 }
}

/// `s || undefined`.
private func nonEmpty(_ s: String?) -> String? {
    s?.isEmpty == false ? s : nil
}

/// Builds the v1 envelope around rows already encoded with `encodeEventRowV1`.
@MainActor
package func buildIngestRequestV1(
    _ context: IKAnalyticsClientContext,
    _ rows: [[Any]],
    _ flushReason: FlushReason,
    _ sentAtMs: Double
) -> IKAnalyticsIngestRequestV1 {
    IKAnalyticsIngestRequestV1(
        v: wireVersion,
        b: "b_\(dateNowMs())_\(randomBase36(8))",
        t: sentAtMs,
        r: flushReason.rawValue,
        c: encodeContextV1(context),
        e: rows
    )
}
