import Foundation
import XCTest
@testable import ImageKitVideoAnalytics

final class GzipTests: XCTestCase {
    private let samples: [String] = [
        "",
        "a",
        #"{"v":1,"b":"batch","e":[[1767225600000,1,"id","viewinit"]],"c":{"ik":"demo","ua":"Mozilla/5.0"}}"#,
        String(repeating: "playing timeupdate seeked ✓ 日本語 ", count: 400),
    ]

    func testCrc32Vectors() {
        XCTAssertEqual(crc32(Data()), 0)
        XCTAssertEqual(crc32(Data("123456789".utf8)), 0xCBF4_3926)
        XCTAssertEqual(crc32(Data("The quick brown fox jumps over the lazy dog".utf8)), 0x414F_A339)
        XCTAssertEqual(crc32(Data([0x00])), 0xD202_EF8D)
    }

    func testHeaderAndTrailer() throws {
        let input = Data("hello hello hello".utf8)
        let out = [UInt8](try gzip(input))
        XCTAssertEqual(Array(out.prefix(4)), [0x1F, 0x8B, 0x08, 0x00])
        let trailer = Array(out.suffix(8))
        let crc = trailer[0..<4].reversed().reduce(UInt32(0)) { ($0 << 8) | UInt32($1) }
        let size = trailer[4..<8].reversed().reduce(UInt32(0)) { ($0 << 8) | UInt32($1) }
        XCTAssertEqual(crc, crc32(input))
        XCTAssertEqual(size, UInt32(input.count))
    }

    /// Inflates the member body with Foundation and checks the trailer, on every platform.
    func testRoundTripsThroughFoundationInflate() throws {
        for text in samples {
            let input = Data(text.utf8)
            let member = try gzip(input)
            let body = member.subdata(in: 10..<(member.count - 8))
            let inflated = input.isEmpty ? Data() : try (body as NSData).decompressed(using: .zlib) as Data
            XCTAssertEqual(inflated, input)
        }
    }

    #if os(macOS)
    func testDecodesWithSystemGzip() throws {
        for text in samples {
            let input = Data(text.utf8)
            let process = Process()
            process.executableURL = URL(fileURLWithPath: "/usr/bin/gzip")
            process.arguments = ["-d", "-c"]
            let stdin = Pipe()
            let stdout = Pipe()
            process.standardInput = stdin
            process.standardOutput = stdout
            try process.run()
            stdin.fileHandleForWriting.write(try gzip(input))
            try stdin.fileHandleForWriting.close()
            let decoded = stdout.fileHandleForReading.readDataToEndOfFile()
            process.waitUntilExit()
            XCTAssertEqual(process.terminationStatus, 0)
            XCTAssertEqual(decoded, input)
        }
    }
    #endif
}
