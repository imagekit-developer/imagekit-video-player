// RFC 6381 codec strings from AVFoundation format descriptions, in the form web's VHS reports them
// (`avc1.64001f`, `mp4a.40.2`), so both platforms group under the same values.
import CoreMedia
import Foundation

func fourCCString(_ code: FourCharCode) -> String {
    let bytes = [24, 16, 8, 0].map { UInt8((code >> $0) & 0xFF) }
    guard bytes.allSatisfy({ $0 >= 0x20 && $0 < 0x7F }) else { return String(format: "0x%08x", code) }
    return String(decoding: bytes, as: UTF8.self).trimmingCharacters(in: .whitespaces)
}

private func fourCC(_ s: String) -> FourCharCode {
    s.utf8.reduce(0) { ($0 << 8) | FourCharCode($1) }
}

private func hex2(_ byte: UInt8) -> String {
    String(format: "%02x", byte)
}

/// `avc1.PPCCLL`: profile, constraint flags and level from the avcC box payload.
func avcCodecString(fourCC: String, avcC: Data) -> String? {
    let b = [UInt8](avcC.prefix(4))
    guard b.count == 4, b[0] == 1 else { return nil }
    return "\(fourCC).\(hex2(b[1]))\(hex2(b[2]))\(hex2(b[3]))"
}

/// `hvc1.[A-C]P.C.TL.B…` from the hvcC box payload (ISO/IEC 14496-15 Annex E): profile space and
/// profile, compatibility flags bit-reversed in hex, tier and level, then constraint bytes up to
/// the last non-zero one.
func hevcCodecString(fourCC: String, hvcC: Data) -> String? {
    let b = [UInt8](hvcC.prefix(13))
    guard b.count == 13, b[0] == 1 else { return nil }
    let profileSpace = Int(b[1] >> 6)
    let tier = (b[1] >> 5) & 1
    let profile = b[1] & 0x1F
    let compatibility = b[2...5].reduce(UInt32(0)) { ($0 << 8) | UInt32($1) }
    var reversed: UInt32 = 0
    for bit in 0..<32 where compatibility & (1 << UInt32(bit)) != 0 {
        reversed |= 1 << UInt32(31 - bit)
    }
    var constraints = Array(b[6...11])
    while let last = constraints.last, last == 0 { constraints.removeLast() }
    var s = "\(fourCC).\(["", "A", "B", "C"][profileSpace])\(profile)"
    s += ".\(String(reversed, radix: 16, uppercase: true))"
    s += ".\(tier == 1 ? "H" : "L")\(b[12])"
    for c in constraints { s += ".\(String(c, radix: 16, uppercase: true))" }
    return s
}

private struct ByteReader {
    let bytes: [UInt8]
    var offset = 0

    var remaining: Int {
        bytes.count - offset
    }

    mutating func byte() -> UInt8? {
        guard offset < bytes.count else { return nil }
        defer { offset += 1 }
        return bytes[offset]
    }

    mutating func skip(_ n: Int) -> Bool {
        guard n >= 0, n <= remaining else { return false }
        offset += n
        return true
    }

    /// MPEG-4 descriptor header (ISO/IEC 14496-1 §8.3.3): tag, then a size of up to four 7-bit bytes.
    mutating func descriptorHeader() -> (tag: UInt8, size: Int)? {
        guard let tag = byte() else { return nil }
        var size = 0
        for _ in 0..<4 {
            guard let b = byte() else { return nil }
            size = (size << 7) | Int(b & 0x7F)
            if b & 0x80 == 0 { return (tag, size) }
        }
        return (tag, size)
    }
}

/// Audio object type from an AudioSpecificConfig (5 bits; 31 escapes to 32 + the next 6 bits).
func audioObjectType(_ audioSpecificConfig: Data) -> Int? {
    let b = [UInt8](audioSpecificConfig.prefix(2))
    guard let first = b.first else { return nil }
    let aot = Int(first >> 3)
    if aot != 31 { return aot }
    guard b.count == 2 else { return nil }
    return 32 + Int(((first & 0x07) << 3) | (b[1] >> 5))
}

/// `mp4a.OO[.A]` from an ES_Descriptor (esds payload, with or without its version and flags).
func mp4aCodecString(esds: Data) -> String? {
    var bytes = [UInt8](esds)
    if bytes.first != 0x03, bytes.count > 4, bytes[0...3] == [0, 0, 0, 0] { bytes.removeFirst(4) }
    var r = ByteReader(bytes: bytes)
    guard let es = r.descriptorHeader(), es.tag == 0x03, r.skip(2), let flags = r.byte() else { return nil }
    if flags & 0x80 != 0, !r.skip(2) { return nil }
    if flags & 0x40 != 0 {
        guard let urlLength = r.byte(), r.skip(Int(urlLength)) else { return nil }
    }
    if flags & 0x20 != 0, !r.skip(2) { return nil }
    while r.remaining > 0 {
        guard let header = r.descriptorHeader() else { return nil }
        guard header.tag == 0x04 else {
            guard r.skip(header.size) else { return nil }
            continue
        }
        let configEnd = r.offset + header.size
        guard let objectType = r.byte(), r.skip(12) else { return nil }
        guard objectType == 0x40 else { return "mp4a.\(hex2(objectType))" }
        while r.offset < configEnd, let inner = r.descriptorHeader() {
            if inner.tag == 0x05 {
                let end = Swift.min(r.offset + inner.size, bytes.count)
                guard let aot = audioObjectType(Data(bytes[r.offset..<end])) else { return "mp4a.40" }
                return "mp4a.40.\(aot)"
            }
            guard r.skip(inner.size) else { break }
        }
        return "mp4a.40"
    }
    return nil
}

private let aacFormats: [FourCharCode: Int] = [
    fourCC("aac "): 2,
    fourCC("aach"): 5,
    fourCC("aacp"): 29,
]

private let fixedAudioCodecs: [FourCharCode: String] = [
    fourCC(".mp3"): "mp4a.40.34",
    fourCC("ac-3"): "ac-3",
    fourCC("ec-3"): "ec-3",
    fourCC("opus"): "opus",
    fourCC("fLaC"): "flac",
]

private func audioCodecString(_ fd: CMFormatDescription, _ subType: FourCharCode) -> String {
    if let fallbackType = aacFormats[subType] {
        var cookieSize = 0
        if let cookie = CMAudioFormatDescriptionGetMagicCookie(fd, sizeOut: &cookieSize), cookieSize > 0 {
            let data = Data(bytes: cookie, count: cookieSize)
            if let codec = mp4aCodecString(esds: data) { return codec }
            if let aot = audioObjectType(data) { return "mp4a.40.\(aot)" }
        }
        return "mp4a.40.\(fallbackType)"
    }
    return fixedAudioCodecs[subType] ?? fourCCString(subType)
}

private func videoCodecString(_ fd: CMFormatDescription, _ subType: FourCharCode) -> String {
    let name = fourCCString(subType)
    let atoms = CMFormatDescriptionGetExtension(
        fd,
        extensionKey: kCMFormatDescriptionExtension_SampleDescriptionExtensionAtoms
    ) as? [String: Any]
    switch name {
    case "avc1", "avc3":
        if let avcC = atoms?["avcC"] as? Data, let codec = avcCodecString(fourCC: name, avcC: avcC) { return codec }
    case "hvc1", "hev1":
        if let hvcC = atoms?["hvcC"] as? Data, let codec = hevcCodecString(fourCC: name, hvcC: hvcC) { return codec }
    default:
        break
    }
    return name
}

/// RFC 6381 string for an audio or video format description; the FourCC when it cannot be built.
func codecString(_ fd: CMFormatDescription) -> String? {
    let subType = CMFormatDescriptionGetMediaSubType(fd)
    switch CMFormatDescriptionGetMediaType(fd) {
    case kCMMediaType_Video:
        return videoCodecString(fd, subType)
    case kCMMediaType_Audio:
        return audioCodecString(fd, subType)
    default:
        return nil
    }
}
