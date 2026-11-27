import Foundation
import ImageKitVideoAnalyticsCore

/// Which AVFoundation signal reported a fatal error.
enum PlayerErrorSource: String {
    case itemStatusFailed = "item_status_failed"
    case failedToPlayToEnd = "failed_to_play_to_end"
}

private let httpStatusPattern = try? NSRegularExpression(pattern: "HTTP ([1-5][0-9]{2})")

private func errorChain(_ error: NSError) -> [NSError] {
    var out = [error]
    if let underlying = error.userInfo[NSUnderlyingErrorKey] as? NSError {
        out += errorChain(underlying)
    }
    if let many = error.userInfo[NSMultipleUnderlyingErrorsKey] as? [NSError] {
        for e in many { out += errorChain(e) }
    }
    return out
}

/// HLS failures carry it only as text, e.g. "HTTP 404: File Not Found" in a CoreMedia error.
private func httpStatus(in chain: [NSError]) -> Int? {
    guard let httpStatusPattern else { return nil }
    for e in chain {
        let texts = [e.localizedDescription] + e.userInfo.values.compactMap { $0 as? String }
        for text in texts {
            let range = NSRange(text.startIndex..., in: text)
            if let match = httpStatusPattern.firstMatch(in: text, range: range),
               let r = Range(match.range(at: 1), in: text) {
                return Int(text[r])
            }
        }
    }
    return nil
}

private func failingUrl(in chain: [NSError]) -> String? {
    for e in chain {
        if let url = e.userInfo[NSURLErrorFailingURLErrorKey] as? URL { return url.absoluteString }
        if let url = e.userInfo[NSURLErrorFailingURLStringErrorKey] as? String { return url }
    }
    return nil
}

/// `error_code` is the top-level `domain:code`, or the first underlying error's when the top level is
/// AVFoundation's generic -11800. Context: the signal, HTTP status, failing URL and playhead, as JSON.
func playerErrorInfo(
    _ error: (any Error)?,
    source: PlayerErrorSource,
    playheadSeconds: Double?,
    errorLogUri: String?
) -> AnalyticsErrorInfo {
    var context: [String: Any] = ["source": source.rawValue]
    if let playheadSeconds, playheadSeconds.isFinite {
        context["playhead_ms"] = Int((playheadSeconds * 1000).rounded())
    }
    var code = "UNKNOWN"
    var message: String?
    if let error {
        let top = error as NSError
        var reported = top
        if top.domain == "AVFoundationErrorDomain", top.code == -11800,
           let underlying = top.userInfo[NSUnderlyingErrorKey] as? NSError {
            reported = underlying
        }
        code = "\(reported.domain):\(reported.code)"
        message = reported.localizedDescription
        let chain = errorChain(top)
        if let status = httpStatus(in: chain) { context["http_status"] = status }
        if let url = failingUrl(in: chain) ?? errorLogUri { context["url"] = url }
    } else if let errorLogUri {
        context["url"] = errorLogUri
    }
    let json = (try? JSONSerialization.data(withJSONObject: context, options: [.sortedKeys, .withoutEscapingSlashes]))
        .flatMap { String(data: $0, encoding: .utf8) }
    return AnalyticsErrorInfo(code: code, message: message, context: json)
}
