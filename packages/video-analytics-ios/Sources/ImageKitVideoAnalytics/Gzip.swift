import Foundation

private let crc32Table: [UInt32] = (0..<256).map { n in
    var c = UInt32(n)
    for _ in 0..<8 {
        c = c & 1 != 0 ? 0xEDB8_8320 ^ (c >> 1) : c >> 1
    }
    return c
}

/// CRC-32 (ISO 3309 / ITU-T V.42), as gzip's trailer uses.
func crc32(_ data: Data) -> UInt32 {
    var c: UInt32 = 0xFFFF_FFFF
    for byte in data {
        c = crc32Table[Int((c ^ UInt32(byte)) & 0xFF)] ^ (c >> 8)
    }
    return c ^ 0xFFFF_FFFF
}

private func appendLittleEndian(_ value: UInt32, to data: inout Data) {
    withUnsafeBytes(of: value.littleEndian) { data.append(contentsOf: $0) }
}

/// RFC 1952 gzip member around a raw DEFLATE stream (`NSData.compressed(using: .zlib)` writes raw
/// RFC 1951 data, without the zlib header).
func gzip(_ input: Data) throws -> Data {
    let deflated: Data = input.isEmpty
        ? Data([0x03, 0x00])
        : try (input as NSData).compressed(using: .zlib) as Data
    var out = Data([0x1F, 0x8B, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xFF])
    out.append(deflated)
    appendLittleEndian(crc32(input), to: &out)
    appendLittleEndian(UInt32(truncatingIfNeeded: input.count), to: &out)
    return out
}
