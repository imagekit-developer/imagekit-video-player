import Foundation
import XCTest
@testable import ImageKitVideoAnalytics

private func nsError(
    _ domain: String,
    _ code: Int,
    _ description: String? = nil,
    underlying: NSError? = nil,
    extra: [String: Any] = [:]
) -> NSError {
    var info = extra
    if let description { info[NSLocalizedDescriptionKey] = description }
    if let underlying { info[NSUnderlyingErrorKey] = underlying }
    return NSError(domain: domain, code: code, userInfo: info)
}

private func context(_ json: String?) throws -> [String: Any] {
    let data = try XCTUnwrap(json?.data(using: .utf8))
    return try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
}

/// The chains recorded in the codec / error spike (iOS 26.5 simulator).
final class ErrorMappingTests: XCTestCase {
    func testHlsMaster404() throws {
        let error = nsError(
            "NSURLErrorDomain", -1100, "The requested URL was not found on this server.",
            underlying: nsError(
                "CoreMediaErrorDomain", -12938,
                "The operation couldn’t be completed. (CoreMediaErrorDomain error -12938 - HTTP 404: File Not Found)",
                extra: ["NSDescription": "HTTP 404: File Not Found"]
            )
        )
        let info = playerErrorInfo(
            error,
            source: .itemStatusFailed,
            playheadSeconds: 0,
            errorLogUri: "https://ik.imagekit.io/demo/missing.mp4/ik-master.m3u8"
        )
        XCTAssertEqual(info.code, "NSURLErrorDomain:-1100")
        XCTAssertEqual(info.message, "The requested URL was not found on this server.")
        let ctx = try context(info.context)
        XCTAssertEqual(ctx["source"] as? String, "item_status_failed")
        XCTAssertEqual(ctx["http_status"] as? Int, 404)
        XCTAssertEqual(ctx["url"] as? String, "https://ik.imagekit.io/demo/missing.mp4/ik-master.m3u8")
        XCTAssertEqual(ctx["playhead_ms"] as? Int, 0)
        XCTAssertEqual(
            info.context,
            #"{"http_status":404,"playhead_ms":0,"source":"item_status_failed","url":"https://ik.imagekit.io/demo/missing.mp4/ik-master.m3u8"}"#
        )
    }

    func testMp4404HasNoHttpStatusText() throws {
        let error = nsError(
            "NSURLErrorDomain", -1100, "The requested URL was not found on this server.",
            underlying: nsError("NSOSStatusErrorDomain", -12938)
        )
        let info = playerErrorInfo(error, source: .itemStatusFailed, playheadSeconds: nil, errorLogUri: nil)
        XCTAssertEqual(info.code, "NSURLErrorDomain:-1100")
        let ctx = try context(info.context)
        XCTAssertNil(ctx["http_status"])
        XCTAssertNil(ctx["url"])
        XCTAssertNil(ctx["playhead_ms"])
    }

    func testServerErrorAndForbidden() throws {
        let e500 = nsError(
            "NSURLErrorDomain", -1008, "resource unavailable",
            underlying: nsError(
                "CoreMediaErrorDomain", -16847,
                "The operation couldn’t be completed. (CoreMediaErrorDomain error -16847 - HTTP 500: Internal Server Error)"
            )
        )
        let info500 = playerErrorInfo(e500, source: .itemStatusFailed, playheadSeconds: 1.2345, errorLogUri: nil)
        XCTAssertEqual(info500.code, "NSURLErrorDomain:-1008")
        XCTAssertEqual(try context(info500.context)["http_status"] as? Int, 500)
        XCTAssertEqual(try context(info500.context)["playhead_ms"] as? Int, 1235)

        let e403 = nsError("NSURLErrorDomain", -1102, underlying: nsError("CoreMediaErrorDomain", -12660))
        XCTAssertEqual(playerErrorInfo(e403, source: .itemStatusFailed, playheadSeconds: 0, errorLogUri: nil).code,
                       "NSURLErrorDomain:-1102")
    }

    func testConnectionAndDnsFailuresCarryTheFailingUrl() throws {
        let url = URL(string: "http://127.0.0.1:1/x.m3u8")!
        let refused = nsError(
            "NSURLErrorDomain", -1004, "Could not connect to the server.",
            underlying: nsError("kCFErrorDomainCFNetwork", -1004),
            extra: [NSURLErrorFailingURLErrorKey: url]
        )
        let info = playerErrorInfo(refused, source: .itemStatusFailed, playheadSeconds: 0, errorLogUri: "ignored")
        XCTAssertEqual(info.code, "NSURLErrorDomain:-1004")
        XCTAssertEqual(try context(info.context)["url"] as? String, "http://127.0.0.1:1/x.m3u8")

        let dns = nsError(
            "NSURLErrorDomain", -1003,
            underlying: nsError(
                "kCFErrorDomainCFNetwork", -1003,
                extra: [NSURLErrorFailingURLStringErrorKey: "https://nonexistent.invalid/x.m3u8"]
            )
        )
        let dnsInfo = playerErrorInfo(dns, source: .itemStatusFailed, playheadSeconds: 0, errorLogUri: nil)
        XCTAssertEqual(dnsInfo.code, "NSURLErrorDomain:-1003")
        XCTAssertEqual(try context(dnsInfo.context)["url"] as? String, "https://nonexistent.invalid/x.m3u8")
    }

    func testNotMediaAndBadPlaylists() {
        let notMedia = nsError("AVFoundationErrorDomain", -11850, underlying: nsError("NSOSStatusErrorDomain", -12939))
        XCTAssertEqual(playerErrorInfo(notMedia, source: .itemStatusFailed, playheadSeconds: 0, errorLogUri: nil).code,
                       "AVFoundationErrorDomain:-11850")
        let badTags = nsError("CoreMediaErrorDomain", -12642)
        XCTAssertEqual(playerErrorInfo(badTags, source: .itemStatusFailed, playheadSeconds: 0, errorLogUri: nil).code,
                       "CoreMediaErrorDomain:-12642")
    }

    func testGeneric11800ReportsTheFirstUnderlyingError() throws {
        let error = nsError(
            "AVFoundationErrorDomain", -11800, "The operation could not be completed",
            underlying: nsError(
                "NSOSStatusErrorDomain", -12938, "underlying",
                underlying: nsError("CoreMediaErrorDomain", -12938, "deeper - HTTP 404: File Not Found")
            )
        )
        let info = playerErrorInfo(error, source: .failedToPlayToEnd, playheadSeconds: 42, errorLogUri: nil)
        XCTAssertEqual(info.code, "NSOSStatusErrorDomain:-12938")
        XCTAssertEqual(info.message, "underlying")
        let ctx = try context(info.context)
        XCTAssertEqual(ctx["source"] as? String, "failed_to_play_to_end")
        XCTAssertEqual(ctx["http_status"] as? Int, 404)
        XCTAssertEqual(ctx["playhead_ms"] as? Int, 42000)
    }

    func testGeneric11800WithoutUnderlyingKeepsTheTopLevel() {
        let error = nsError("AVFoundationErrorDomain", -11800)
        XCTAssertEqual(playerErrorInfo(error, source: .itemStatusFailed, playheadSeconds: 0, errorLogUri: nil).code,
                       "AVFoundationErrorDomain:-11800")
    }

    func testMidPlaybackNetworkDrop() throws {
        let error = nsError("NSURLErrorDomain", -1004, underlying: nsError("kCFErrorDomainCFNetwork", -1004))
        let info = playerErrorInfo(
            error,
            source: .failedToPlayToEnd,
            playheadSeconds: 12.5,
            errorLogUri: "https://cdn.example.com/seg42.ts"
        )
        XCTAssertEqual(info.code, "NSURLErrorDomain:-1004")
        let ctx = try context(info.context)
        XCTAssertEqual(ctx["url"] as? String, "https://cdn.example.com/seg42.ts")
        XCTAssertEqual(ctx["playhead_ms"] as? Int, 12500)
    }

    func testMissingError() throws {
        let info = playerErrorInfo(nil, source: .failedToPlayToEnd, playheadSeconds: .nan, errorLogUri: nil)
        XCTAssertEqual(info.code, "UNKNOWN")
        XCTAssertNil(info.message)
        XCTAssertEqual(info.context, #"{"source":"failed_to_play_to_end"}"#)
    }
}
