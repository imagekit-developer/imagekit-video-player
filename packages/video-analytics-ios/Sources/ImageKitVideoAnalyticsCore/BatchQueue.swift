// Batches analytics events and flushes to ingest server.
// Size-based flush trigger is a heuristic to keep URLs under typical server limits;
// it does not strictly guarantee compliance, especially without gzip.

package struct BatchQueueOptions {
    package var ingestUrl: String
    package var flushIntervalMs: Double
    package var maxBatchSize: Int
    package var transport: any AnalyticsTransport
    package var debugLog: @MainActor (String, Any?) -> Void
    package var clock: any AnalyticsClock

    package init(
        ingestUrl: String,
        flushIntervalMs: Double,
        maxBatchSize: Int,
        transport: any AnalyticsTransport,
        debugLog: @escaping @MainActor (String, Any?) -> Void,
        clock: any AnalyticsClock
    ) {
        self.ingestUrl = ingestUrl
        self.flushIntervalMs = flushIntervalMs
        self.maxBatchSize = maxBatchSize
        self.transport = transport
        self.debugLog = debugLog
        self.clock = clock
    }
}

@MainActor
package final class BatchQueue {
    private let ingestUrl: String
    private let maxBatchSize: Int
    private let transport: any AnalyticsTransport
    private let debugLog: @MainActor (String, Any?) -> Void
    private let clock: any AnalyticsClock
    private let rawFlushThreshold: Int
    private var rows: [[Any]] = []
    // JSON length of the queued rows, separators included, in UTF-16 code units like `String.length`.
    private var rowsJsonLength = 0
    private var lastContext: IKAnalyticsClientContext?
    private var stopInterval: (@MainActor () -> Void)?
    private var disposed = false

    package init(_ opts: BatchQueueOptions) {
        ingestUrl = opts.ingestUrl
        maxBatchSize = opts.maxBatchSize
        transport = opts.transport
        debugLog = opts.debugLog
        clock = opts.clock
        // Without gzip, base64url expands the payload by ~4/3, so the raw-JSON ceiling must be tighter.
        rawFlushThreshold = transport.supportsCompression
            ? analyticsRawJsonFlushThreshold
            : Int((Double(analyticsUrlSafeLimitBytes) / 1.37).rounded(.down))

        stopInterval = scheduleRepeating(
            clock,
            { [weak self] in
                guard let self else { return }
                if !rows.isEmpty { doFlush(.interval) }
            },
            everyMs: opts.flushIntervalMs
        )
    }

    private func doFlush(_ reason: FlushReason) {
        guard !rows.isEmpty, let lastContext else { return }
        if disposed && reason != .dispose && reason != .pagehide && reason != .visibilityHidden { return }
        let req = buildIngestRequestV1(lastContext, rows, reason, clock.now())
        rows.removeAll()
        rowsJsonLength = 0
        let debugLog = debugLog
        let flushReason = req.r
        let eventCount = req.e.count
        transport.send(req, options: AnalyticsSendOptions(ingestUrl: ingestUrl)) { result in
            switch result {
            case .success(let sent):
                debugLog(
                    "beacon \(flushReason): \(eventCount) events, \(sent.jsonBytes) B JSON → \(sent.urlBytes) B URL"
                        + (sent.gzipped ? " (gzip)" : " (uncompressed)"),
                    nil
                )
            case .failure(let err):
                debugLog("beacon \(flushReason) failed", err)
            }
        }
    }

    private func projectedBatchJsonLength(_ context: IKAnalyticsClientContext) throws -> Int {
        let envelope = try jsonStringify(buildIngestRequestV1(context, [], .sizeLimit, clock.now()).jsonObject)
        return envelope.utf16.count + rowsJsonLength
    }

    /// `row` from `encodeEventRowV1`; `context` is sent once per batch, so it must not change under queued rows.
    package func push(_ row: [Any], _ context: IKAnalyticsClientContext) throws {
        if disposed { return }
        lastContext = context
        rowsJsonLength += try jsonStringify(row).utf16.count + (rows.count > 0 ? 1 : 0)
        rows.append(row)

        if rows.count >= maxBatchSize {
            doFlush(.bufferFull)
            return
        }

        if try projectedBatchJsonLength(context) >= rawFlushThreshold {
            doFlush(.sizeLimit)
        }
    }

    package func flush(_ reason: FlushReason) {
        doFlush(reason)
    }

    package func dispose() {
        if disposed { return }
        // Flush BEFORE marking disposed so doFlush actually sends.
        flush(.dispose)
        disposed = true
        stopInterval?()
        stopInterval = nil
    }
}
