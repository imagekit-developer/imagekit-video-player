import Foundation
import XCTest
@testable import ImageKitVideoAnalyticsCore

private let tsSources = fixturesDirectory
    .deletingLastPathComponent().deletingLastPathComponent()
    .appendingPathComponent("src")

final class WireFormatV1Tests: XCTestCase {
    // Expected values come from the TS `truncateBytes`.
    func testTruncateBytes() {
        let a = { (n: Int) in String(repeating: "a", count: n) }
        XCTAssertNil(truncateBytes(nil, 256))
        XCTAssertEqual(truncateBytes(a(256), 256), a(256))
        XCTAssertEqual(truncateBytes(a(257), 256), a(253) + "…")
        XCTAssertEqual(truncateBytes(String(repeating: "é", count: 200), 256), String(repeating: "é", count: 126) + "…")
        XCTAssertEqual(truncateBytes(String(repeating: "中", count: 100), 256), String(repeating: "中", count: 84) + "…")
        XCTAssertEqual(truncateBytes("ab", 3), "ab")
        XCTAssertEqual(truncateBytes("abcd", 3), "…")
    }

    func testTruncateBytesNeverSplitsAnEmoji() {
        let a = { (n: Int) in String(repeating: "a", count: n) }
        XCTAssertEqual(truncateBytes(a(252) + "😀b", 256), a(252) + "…")
        XCTAssertEqual(truncateBytes(a(251) + "😀", 256), a(251) + "😀")
        XCTAssertEqual(truncateBytes(a(250) + "😀😀", 256), a(250) + "…")
        XCTAssertEqual(truncateBytes("😀😀😀", 10), "😀…")
    }

    private func event(_ name: IKAnalyticsEventName = .play) -> AnalyticsEvent {
        AnalyticsEvent(
            event: name,
            eventId: "e1",
            playbackId: "p1",
            eventOrder: 3,
            previousEvent: nil,
            msFromPreviousEvent: 12
        )
    }

    func testEncodeEventRowTrimsTrailingNulls() throws {
        let row = encodeEventRowV1(event(), 1_767_225_600_123.7)
        XCTAssertEqual(try jsonStringify(row), #"[1767225600123,3,"e1","play",null,12,"p1"]"#)

        var withContext = event(.error)
        withContext.errorContext = "ctx"
        XCTAssertEqual(encodeEventRowV1(withContext, 0).count, eventFieldsV1.firstIndex(of: "error_context")! + 1)

        var emptyStrings = event()
        emptyStrings.errorMessage = ""
        emptyStrings.audioCodec = ""
        XCTAssertEqual(encodeEventRowV1(emptyStrings, 0).count, 7)
    }

    func testEncodeEventRowWritesNaNAsNullWithoutTrimmingIt() throws {
        var e = event()
        e.nextPlaybackId = "p2"
        e.bitrate = .nan
        let json = try jsonStringify(encodeEventRowV1(e, .nan))
        XCTAssertEqual(json, #"[null,3,"e1","play",null,12,"p1",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,"p2"]"#)
        var trailing = event()
        trailing.previousSessionId = nil
        trailing.bitrate = .nan
        XCTAssertEqual(encodeEventRowV1(trailing, 0).count, eventFieldsV1.firstIndex(of: "bitrate")! + 1)
    }

    /// Same row and same `JSON.stringify(row).length` as the TS encoder (values from node).
    func testEncodeEventRowMatchesTheTSBytes() throws {
        var e = event(.error)
        e.errorCode = "X"
        e.errorMessage = "Ünïcödé 😀 / \"q\""
        e.playbackTimeInstantMs = 1234.5
        e.videoSourceUrl = "https://ik.imagekit.io/a/b.M3U8?tr=x"
        let json = try jsonStringify(encodeEventRowV1(e, 1_767_225_600_123.7))
        XCTAssertEqual(
            json,
            #"[1767225600123,3,"e1","error",null,12,"p1","https://ik.imagekit.io/a/b.M3U8?tr=x","hls",null,null,null,1234.5,null,null,null,null,null,null,null,null,null,"X","Ünïcödé 😀 / \"q\""]"#
        )
        XCTAssertEqual(json.utf16.count, 180)
    }

    func testJsonNumberWritesNumbersLikeJS() throws {
        let values: [Double] = [2000, -0.0, 0.1, 2.625, 1.0 / 3.0, 1234.5, 1.1e20]
        XCTAssertEqual(
            try jsonStringify(values.map(jsonNumber)),
            "[2000,0,0.1,2.625,0.3333333333333333,1234.5,110000000000000000000]"
        )
        XCTAssertTrue(jsonNumber(.infinity) is NSNull)
    }

    @MainActor
    func testContextUsesShortKeys() throws {
        let context = IKAnalyticsClientContext(
            imagekitId: "ik1",
            sessionId: "s1",
            playerInstanceId: "p1",
            userId: nil,
            pageUrl: "",
            deviceDisplayWidth: 390,
            deviceDisplayHeight: 844,
            deviceDisplayDpr: 3,
            userAgent: "ua",
            sessionStartDate: "2026-01-01",
            sessionStartTimeIso: "2026-01-01T00:00:00.000Z",
            playerSoftware: "AVPlayer",
            playerSoftwareVersion: "26.0",
            imagekitPlugin: "imagekit-video-analytics-ios",
            imagekitPluginVersion: "0.1.0",
            customDimensions: ["cd_1": "x"],
            webdriver: nil
        )
        context.playerWidthPixels = 390
        context.playerHeightPixels = 219.5
        context.playerAutoplay = false
        context.playerPreload = "auto"
        let encoded = try decoded(encodeContextV1(context)) as! [String: Any]
        let expected: [String: Any] = [
            "ik": "ik1", "s": "s1", "p": "p1", "url": "", "dw": 390, "dh": 844, "dpr": 3, "ua": "ua",
            "ssd": "2026-01-01", "sst": "2026-01-01T00:00:00.000Z", "psw": "AVPlayer", "psv": "26.0",
            "ip": "imagekit-video-analytics-ios", "ipv": "0.1.0", "pw": 390, "ph": 219.5, "pa": false, "pp": "auto",
            "cd": ["cd_1": "x"],
        ]
        XCTAssertTrue(jsonEqual(encoded, try decoded(expected)), render(encoded))
        XCTAssertEqual(try jsonStringify(["pa": encodeContextV1(context)["pa"]!]), #"{"pa":false}"#)
    }

    #if os(macOS)
    /// The field order and key map are read from wire-format-v1.ts, so the two cannot drift apart.
    func testWireTablesMatchTheTSSource() throws {
        let ts = try String(contentsOf: tsSources.appendingPathComponent("wire-format-v1.ts"), encoding: .utf8)
        let fields = matches(#"^\s*'([a-z_]+)',\s*//\s*\d+"#, in: ts).map { $0[0] }
        XCTAssertEqual(fields, eventFieldsV1)
        let keyMapBody = ts.components(separatedBy: "CONTEXT_KEY_MAP_V1: Record")[1].components(separatedBy: "};")[0]
        let pairs = matches(#"^\s*([a-z]+): '([a-z_]+)',"#, in: keyMapBody)
        XCTAssertEqual(pairs.count, 21)
        XCTAssertEqual(Dictionary(uniqueKeysWithValues: pairs.map { ($0[0], $0[1]) }), contextKeyMapV1)
        XCTAssertEqual(contextKeyMapV1Inverse["custom_dimensions"], "cd")
        XCTAssertEqual(contextKeyMapV1Inverse["session_start_time_iso"], "sst")
    }

    private func matches(_ pattern: String, in text: String) -> [[String]] {
        let regex = try! NSRegularExpression(pattern: pattern, options: [.anchorsMatchLines])
        let ns = text as NSString
        return regex.matches(in: text, range: NSRange(location: 0, length: ns.length)).map { m in
            (1..<m.numberOfRanges).map { ns.substring(with: m.range(at: $0)) }
        }
    }
    #endif

    func testDeriveVideoSourceType() {
        XCTAssertEqual(deriveVideoSourceType("https://ik.imagekit.io/a/master.M3U8?tr=sr-240_360"), .hls)
        XCTAssertEqual(deriveVideoSourceType("https://x/a.mpd#t=10"), .dash)
        XCTAssertEqual(deriveVideoSourceType("https://x/a.mp4"), .mp4)
        XCTAssertEqual(deriveVideoSourceType("https://x/a.webm?x.mp4"), .webm)
        XCTAssertEqual(deriveVideoSourceType("https://x/manifest(format=m3u8-aapl)"), .other)
        XCTAssertEqual(deriveVideoSourceType("https://x/?file=a.mp4"), .other)
        XCTAssertEqual(deriveVideoSourceType("https://x/a.mp4/ik-video.mp4/tr:sr-240"), .other)
    }
}

final class JSSemanticsTests: XCTestCase {
    func testJsRoundRoundsHalvesUp() {
        XCTAssertEqual(jsRound(2.5), 3)
        XCTAssertEqual(jsRound(-2.5), -2)
        XCTAssertEqual(jsRound(-0.5), 0)
        XCTAssertEqual(jsRound(0.49999999999999994), 0)
        XCTAssertEqual(jsRound(1234.4999), 1234)
    }

    func testIsoStringAndSessionStartDate() {
        XCTAssertEqual(isoString(1_767_225_600_000), "2026-01-01T00:00:00.000Z")
        XCTAssertEqual(isoString(1_767_311_999_999.9), "2026-01-01T23:59:59.999Z")
        XCTAssertEqual(formatSessionStartDate(1_767_311_999_999), "2026-01-01")
    }

    func testRandomIdFormat() {
        let id = randomId()
        XCTAssertNotNil(id.range(of: #"^\d{13}-[0-9a-z]{9}$"#, options: .regularExpression), id)
    }

    func testParseIntBase10() {
        XCTAssertEqual(parseIntBase10("1767225600000"), 1_767_225_600_000)
        XCTAssertEqual(parseIntBase10(" 12.9abc"), 12)
        XCTAssertNil(parseIntBase10("abc"))
        XCTAssertNil(parseIntBase10(""))
    }
}
