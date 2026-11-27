import CoreMedia
import Foundation
import XCTest
@testable import ImageKitVideoAnalytics

private func hexData(_ hex: String) -> Data {
    var bytes: [UInt8] = []
    var index = hex.startIndex
    while index < hex.endIndex {
        let next = hex.index(index, offsetBy: 2)
        bytes.append(UInt8(hex[index..<next], radix: 16)!)
        index = next
    }
    return Data(bytes)
}

/// avcC and esds box payloads from SampleDemonstration.mp4 (the ImageKit test video).
private let sampleAvcC = hexData(
    "01640034ffe1001d67640034ace400f0010fb016a020202800000300080015f90078c1889001000668ebe24b22c0fdf8f800"
)
private let sampleEsdsBox = hexData("00000000038080802200020004808080144015000000000209bd0001fdaa05808080021190068080800102")
/// hvcC of a Main profile, Main tier, level 3.1 stream (`hvc1.1.6.L93.B0`).
private let sampleHvcC = hexData("010160000000b000000000005d" + "f000fcfdf8f800000f03")

final class CodecStringTests: XCTestCase {
    func testAvcFromAvcC() {
        XCTAssertEqual(avcCodecString(fourCC: "avc1", avcC: sampleAvcC), "avc1.640034")
        XCTAssertEqual(avcCodecString(fourCC: "avc3", avcC: hexData("01428015")), "avc3.428015")
        XCTAssertNil(avcCodecString(fourCC: "avc1", avcC: hexData("0164")))
    }

    func testHevcFromHvcC() {
        XCTAssertEqual(hevcCodecString(fourCC: "hvc1", hvcC: sampleHvcC), "hvc1.1.6.L93.B0")
        // Main 10, High tier, level 5.1, profile space 1, two constraint bytes.
        let main10 = hexData("01622000000090008000000099")
        XCTAssertEqual(hevcCodecString(fourCC: "hev1", hvcC: main10), "hev1.A2.4.H153.90.0.80")
        XCTAssertNil(hevcCodecString(fourCC: "hvc1", hvcC: hexData("0101")))
    }

    func testMp4aFromEsds() {
        XCTAssertEqual(mp4aCodecString(esds: sampleEsdsBox), "mp4a.40.2")
        XCTAssertEqual(mp4aCodecString(esds: sampleEsdsBox.dropFirst(4)), "mp4a.40.2")
        // Short descriptor sizes, HE-AAC (object type 5).
        XCTAssertEqual(mp4aCodecString(esds: hexData("031900000004114015000000000000000000000005022b10")), "mp4a.40.5")
        // MP3 (object type indication 0x6B).
        XCTAssertEqual(mp4aCodecString(esds: hexData("0312000000040d6b150000000000000000000000")), "mp4a.6b")
        XCTAssertNil(mp4aCodecString(esds: hexData("0400")))
    }

    func testAudioObjectTypeEscape() {
        XCTAssertEqual(audioObjectType(hexData("1190")), 2)
        // 31 escapes to 32 + 6 bits: 11111 000010 → 34.
        XCTAssertEqual(audioObjectType(hexData("f840")), 34)
    }

    func testFourCCFallback() {
        XCTAssertEqual(fourCCString(0x6176_6331), "avc1")
        XCTAssertEqual(fourCCString(0x6161_6320), "aac")
        XCTAssertEqual(fourCCString(0x0000_0001), "0x00000001")
    }

    func testVideoFormatDescription() throws {
        func make(_ codec: FourCharCode, _ atoms: [String: Data]?) throws -> CMFormatDescription {
            var extensions: [String: Any] = [:]
            if let atoms {
                extensions[kCMFormatDescriptionExtension_SampleDescriptionExtensionAtoms as String] = atoms
            }
            var fd: CMVideoFormatDescription?
            let status = CMVideoFormatDescriptionCreate(
                allocator: nil,
                codecType: codec,
                width: 1920,
                height: 1080,
                extensions: extensions as CFDictionary,
                formatDescriptionOut: &fd
            )
            XCTAssertEqual(status, noErr)
            return try XCTUnwrap(fd)
        }
        XCTAssertEqual(codecString(try make(kCMVideoCodecType_H264, ["avcC": sampleAvcC])), "avc1.640034")
        XCTAssertEqual(codecString(try make(kCMVideoCodecType_HEVC, ["hvcC": sampleHvcC])), "hvc1.1.6.L93.B0")
        XCTAssertEqual(codecString(try make(kCMVideoCodecType_H264, nil)), "avc1")
        XCTAssertEqual(codecString(try make(kCMVideoCodecType_AppleProRes422, nil)), "apcn")
    }

    func testAudioFormatDescription() throws {
        func make(_ formatID: AudioFormatID, cookie: Data?) throws -> CMFormatDescription {
            var asbd = AudioStreamBasicDescription(
                mSampleRate: 48000,
                mFormatID: formatID,
                mFormatFlags: 0,
                mBytesPerPacket: 0,
                mFramesPerPacket: 1024,
                mBytesPerFrame: 0,
                mChannelsPerFrame: 2,
                mBitsPerChannel: 0,
                mReserved: 0
            )
            var fd: CMAudioFormatDescription?
            let status: OSStatus = if let cookie {
                cookie.withUnsafeBytes { raw in
                    CMAudioFormatDescriptionCreate(
                        allocator: nil,
                        asbd: &asbd,
                        layoutSize: 0,
                        layout: nil,
                        magicCookieSize: cookie.count,
                        magicCookie: raw.baseAddress,
                        extensions: nil,
                        formatDescriptionOut: &fd
                    )
                }
            } else {
                CMAudioFormatDescriptionCreate(
                    allocator: nil,
                    asbd: &asbd,
                    layoutSize: 0,
                    layout: nil,
                    magicCookieSize: 0,
                    magicCookie: nil,
                    extensions: nil,
                    formatDescriptionOut: &fd
                )
            }
            XCTAssertEqual(status, noErr)
            return try XCTUnwrap(fd)
        }
        let aac: AudioFormatID = 0x6161_6320 // 'aac '
        XCTAssertEqual(codecString(try make(aac, cookie: sampleEsdsBox.dropFirst(4))), "mp4a.40.2")
        XCTAssertEqual(codecString(try make(aac, cookie: hexData("2b10"))), "mp4a.40.5")
        XCTAssertEqual(codecString(try make(aac, cookie: nil)), "mp4a.40.2")
        XCTAssertEqual(codecString(try make(0x6161_6368, cookie: nil)), "mp4a.40.5") // 'aach'
        XCTAssertEqual(codecString(try make(0x6563_2D33, cookie: nil)), "ec-3")
        XCTAssertEqual(codecString(try make(0x616C_6163, cookie: nil)), "alac")
    }
}
