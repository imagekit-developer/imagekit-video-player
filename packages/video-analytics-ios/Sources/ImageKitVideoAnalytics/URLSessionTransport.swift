import Foundation
import ImageKitVideoAnalyticsCore

/// Gzip and sending both run here, off the main thread.
private let beaconQueue = DispatchQueue(label: "io.imagekit.video-analytics.beacon", qos: .utility)

private let beaconSession: URLSession = {
    let config = URLSessionConfiguration.ephemeral
    config.httpShouldSetCookies = false
    config.httpCookieStorage = nil
    config.urlCache = nil
    config.timeoutIntervalForRequest = 15
    config.timeoutIntervalForResource = 30
    return URLSession(configuration: config)
}()

private func gzipOnBeaconQueue(_ text: String) async throws -> Data {
    try await withCheckedThrowingContinuation { continuation in
        beaconQueue.async {
            continuation.resume(with: Result { try gzip(Data(text.utf8)) })
        }
    }
}

/// Completes when the request has finished, so a background task can be held until then. The
/// response is never read.
private func sendGetOnBeaconQueue(_ urlString: String, _ options: SendGetOptions) async throws {
    guard let url = URL(string: urlString) else { throw URLError(.badURL) }
    try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, any Error>) in
        beaconQueue.async {
            var request = URLRequest(url: url)
            request.httpMethod = "GET"
            beaconSession.dataTask(with: request) { _, _, error in
                if let error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume()
                }
            }.resume()
        }
    }
}

@MainActor
func makeURLSessionBeaconTransport() -> any AnalyticsTransport {
    createBeaconTransport(BeaconTransportOptions(gzip: gzipOnBeaconQueue, sendGet: sendGetOnBeaconQueue))
}

/// Counts sends in flight so a background task can last until the last one has completed.
@MainActor
final class InFlightTrackingTransport: AnalyticsTransport {
    private let inner: any AnalyticsTransport
    private var inFlight = 0
    private var idleWaiters: [@MainActor () -> Void] = []

    init(_ inner: any AnalyticsTransport) {
        self.inner = inner
    }

    var supportsCompression: Bool {
        inner.supportsCompression
    }

    func send(
        _ request: IKAnalyticsIngestRequestV1,
        options: AnalyticsSendOptions,
        completion: @escaping @MainActor (Result<SentBeacon, any Error>) -> Void
    ) {
        inFlight += 1
        inner.send(request, options: options) { [weak self] result in
            completion(result)
            self?.finishOne()
        }
    }

    /// Runs `fn` once nothing is in flight: now, or when the last pending send completes.
    func whenIdle(_ fn: @escaping @MainActor () -> Void) {
        if inFlight == 0 {
            fn()
        } else {
            idleWaiters.append(fn)
        }
    }

    private func finishOne() {
        inFlight -= 1
        if inFlight > 0 { return }
        let waiters = idleWaiters
        idleWaiters.removeAll()
        waiters.forEach { $0() }
    }
}
