// Golden-fixture runner, ported from video-analytics-core/test/run-fixtures.ts: feeds each scenario in
// test/fixtures/*.json through the real tracker on a virtual clock, rebuilds the per-view metrics the
// way ClickHouse and the dashboard do, and compares them, and the rows sent, with the fixture.
// Rules: video-analytics-core/test/fixtures/README.md.
import Foundation
import XCTest
@testable import ImageKitVideoAnalyticsCore

private let tickMs: Double = 250
private let drainMs: Double = 6000
/// 2026-01-01T00:00:00Z
private let epochMs: Double = 1_767_225_600_000
private let defaultSource = "https://ik.imagekit.io/demo/sample.mp4"

let fixturesDirectory = URL(fileURLWithPath: #filePath)
    .deletingLastPathComponent() // ImageKitVideoAnalyticsCoreTests
    .deletingLastPathComponent() // Tests
    .deletingLastPathComponent() // video-analytics-ios
    .deletingLastPathComponent() // packages
    .appendingPathComponent("video-analytics-core/test/fixtures")

/// One file per section of SCENARIOS-SPEC.md, in its order; each holds an array of scenarios.
private let fixtureFiles = ["views.json", "playing-time.json", "rebuffering.json", "seeking.json", "lifecycle.json"]

private struct FixtureSignal {
    var t: Double
    var type: String
    var src: String?
    var to: Double?
    var from: Double?
    var code: String?
    var bitrate: Double?
    var rate: Double?

    init(_ json: [String: Any]) {
        t = (json["t"] as! NSNumber).doubleValue
        type = json["type"] as! String
        src = json["src"] as? String
        to = (json["to"] as? NSNumber)?.doubleValue
        from = (json["from"] as? NSNumber)?.doubleValue
        code = json["code"] as? String
        bitrate = (json["bitrate"] as? NSNumber)?.doubleValue
        rate = (json["rate"] as? NSNumber)?.doubleValue
    }
}

private struct FixturePlayerOptions {
    var sourceUrl: String?
    var durationMs: Double?
    var bitrate: Double?
    var playheadStepMs: Double?

    init(_ json: [String: Any]?) {
        sourceUrl = json?["sourceUrl"] as? String
        durationMs = (json?["durationMs"] as? NSNumber)?.doubleValue
        bitrate = (json?["bitrate"] as? NSNumber)?.doubleValue
        playheadStepMs = (json?["playheadStepMs"] as? NSNumber)?.doubleValue
    }
}

private struct Fixture {
    var id: String
    var title: String
    var player: FixturePlayerOptions
    var signals: [FixtureSignal]
    var expected: [[String: Any]]
    /// Every row the tracker sent, normalized (see `fixtureRows`).
    var rows: [[String: Any]]?
    var knownBug: String?

    init(_ json: [String: Any]) {
        id = json["id"] as! String
        title = json["title"] as! String
        player = FixturePlayerOptions(json["player"] as? [String: Any])
        signals = (json["signals"] as! [[String: Any]]).map(FixtureSignal.init)
        expected = json["expected"] as! [[String: Any]]
        rows = json["rows"] as? [[String: Any]]
        knownBug = json["knownBug"] as? String
    }
}

private func loadFixtures(_ name: String) throws -> [Fixture] {
    let data = try Data(contentsOf: fixturesDirectory.appendingPathComponent(name))
    return (try JSONSerialization.jsonObject(with: data) as! [[String: Any]]).map(Fixture.init)
}

private func viewDefaults() -> [String: Any] {
    [
    "attempt": true,
    "started": true,
    "exitedBeforeStart": false,
    "startupFailure": false,
    "rebufferCount": 0,
    "rebufferMs": 0,
    "seekCount": 0,
    "seekMs": 0,
    "errors": [String](),
    "endReason": "navigation",
    "bitrate": NSNull(),
    "renditionChanges": 0,
    ]
}

// MARK: - Virtual time: the tracker's clock and its timers

@MainActor
private final class VirtualTimer {
    let id: Int
    var at: Double
    var seq: Int
    let fn: @MainActor () -> Void
    let every: Double?

    init(id: Int, at: Double, seq: Int, fn: @escaping @MainActor () -> Void, every: Double?) {
        self.id = id
        self.at = at
        self.seq = seq
        self.fn = fn
        self.every = every
    }
}

@MainActor
private final class VirtualTime {
    var now: Double = 0
    private var seq = 0
    private var nextId = 1
    private var timers: [Int: VirtualTimer] = [:]

    func add(_ fn: @escaping @MainActor () -> Void, _ delayMs: Double, every: Double? = nil) -> Int {
        let id = nextId
        nextId += 1
        let delay = delayMs.isNaN ? 0 : max(0, delayMs)
        timers[id] = VirtualTimer(id: id, at: now + delay, seq: seq, fn: fn, every: every)
        seq += 1
        return id
    }

    func cancel(_ id: Int) {
        timers[id] = nil
    }

    func runUntil(_ t: Double) {
        while true {
            var next: VirtualTimer?
            for timer in timers.values {
                if timer.at > t { continue }
                if let n = next, !(timer.at < n.at || (timer.at == n.at && timer.seq < n.seq)) { continue }
                next = timer
            }
            guard let next else { break }
            now = next.at
            if let every = next.every, every != 0 {
                next.at += every
                next.seq = seq
                seq += 1
            } else {
                timers[next.id] = nil
            }
            next.fn()
        }
        now = t
    }
}

// MARK: - Fake player: a playhead that advances 1 ms per ms (× rate) while playing

@MainActor
private final class FakePlayer: AnalyticsPlayer {
    let software = "fixture"
    let softwareVersion = "1"
    var sourceUrl: String
    var durationMs: Double
    var bitrate: Double?
    private let playheadStepMs: Double
    private let vt: VirtualTime
    private var listener: (@MainActor (PlayerSignal) -> Void)?
    private var rate: Double = 1
    private var basePlayheadMs: Double = 0
    private var advancingSince: Double?
    private var tickTimer: Int?
    private var seeking = false
    private var resumeAfterSeek = false

    init(_ vt: VirtualTime, _ opts: FixturePlayerOptions) {
        self.vt = vt
        sourceUrl = opts.sourceUrl ?? defaultSource
        durationMs = opts.durationMs ?? 60000
        bitrate = opts.bitrate
        playheadStepMs = opts.playheadStepMs ?? 0
    }

    func subscribe(_ listener: @escaping @MainActor (PlayerSignal) -> Void) -> @MainActor () -> Void {
        self.listener = listener
        return { [weak self] in self?.listener = nil }
    }

    func emit(_ signal: PlayerSignal) {
        listener?(signal)
    }

    func playheadMs() -> Double {
        let advanced = advancingSince.map { (vt.now - $0) * rate } ?? 0
        return basePlayheadMs + advanced
    }

    /// What the player reports: some players update `currentTime` only in steps.
    func reportedPlayheadMs() -> Double {
        let ms = playheadMs()
        return playheadStepMs != 0 ? (ms / playheadStepMs).rounded(.down) * playheadStepMs : ms
    }

    var advancing: Bool {
        advancingSince != nil
    }

    func start() {
        if advancingSince != nil { return }
        advancingSince = vt.now
        tickTimer = vt.add({ [weak self] in self?.emit(.timeupdate) }, tickMs, every: tickMs)
    }

    func stop() {
        if advancingSince == nil { return }
        basePlayheadMs = playheadMs()
        advancingSince = nil
        if let tickTimer { vt.cancel(tickTimer) }
        tickTimer = nil
    }

    func load(_ src: String) {
        stop()
        sourceUrl = src
        basePlayheadMs = 0
    }

    func seekTo(_ targetMs: Double) {
        if !seeking { resumeAfterSeek = advancing }
        seeking = true
        stop()
        basePlayheadMs = targetMs
    }

    /// A pause during a seek, which bindings drop: playback stays stopped after `seeked`.
    func pauseWhileSeeking() {
        resumeAfterSeek = false
    }

    func seekDone() {
        seeking = false
        if resumeAfterSeek { start() }
    }

    func setRate(_ rate: Double) {
        let wasAdvancing = advancing
        stop()
        self.rate = rate
        if wasAdvancing { start() }
    }

    func getUiContext() -> PlayerUiContext {
        PlayerUiContext(width: 960, height: 540, autoplay: false, preload: "metadata")
    }

    func getSnapshot() -> PlaybackSnapshot {
        PlaybackSnapshot(duration: durationMs / 1000)
    }

    func getCurrentTime() -> Double? {
        reportedPlayheadMs() / 1000
    }

    func getPlaybackRate() -> Double? {
        rate
    }

    func getBitrate() -> Double? {
        bitrate
    }

    func resetSourceState() {}
}

// MARK: - Platform fakes

/// One sent row, keyed by its `eventFieldsV1` names (null positions left out), plus the batch's session id.
private typealias Ev = [String: Any]

@MainActor
private final class MemoryStorage: KeyValueStorage {
    var memory: [String: String] = [:]
    func getItem(_ key: String) -> String? { memory[key] }
    func setItem(_ key: String, _ value: String) { memory[key] = value }
    func removeItem(_ key: String) { memory[key] = nil }
}

@MainActor
private final class VirtualClock: AnalyticsClock {
    let vt: VirtualTime
    init(_ vt: VirtualTime) { self.vt = vt }
    func now() -> Double { epochMs + vt.now }
    func monotonicNow() -> Double { vt.now }
    func schedule(_ fn: @escaping @MainActor () -> Void, delayMs: Double) -> @MainActor () -> Void {
        let id = vt.add(fn, delayMs)
        return { [vt] in vt.cancel(id) }
    }
}

@MainActor
private final class FixtureLifecycle: AnalyticsLifecycle {
    var handlers: LifecycleHandlers?
    func subscribe(_ handlers: LifecycleHandlers) -> @MainActor () -> Void {
        self.handlers = handlers
        return { [weak self] in self?.handlers = nil }
    }
}

@MainActor
private final class RecordingTransport: AnalyticsTransport {
    let supportsCompression = true
    var events: [Ev] = []
    var decodeFailures: [String] = []

    /// Beacons are compared as decoded JSON: the request goes through `JSONSerialization` both ways.
    func send(
        _ request: IKAnalyticsIngestRequestV1,
        options: AnalyticsSendOptions,
        completion: @escaping @MainActor (Result<SentBeacon, any Error>) -> Void
    ) {
        do {
            let json = try jsonStringify(request.jsonObject)
            let decoded = try JSONSerialization.jsonObject(with: Data(json.utf8)) as! [String: Any]
            events.append(contentsOf: decodeRows(decoded))
        } catch {
            decodeFailures.append("\(error)")
        }
        completion(.success(SentBeacon(jsonBytes: 0, urlBytes: 0, gzipped: true)))
    }

    private func decodeRows(_ request: [String: Any]) -> [Ev] {
        let context = request["c"] as! [String: Any]
        return (request["e"] as! [[Any]]).map { row in
            var ev: Ev = ["session_id": context["s"] ?? NSNull()]
            for (i, field) in eventFieldsV1.enumerated() where i < row.count && !(row[i] is NSNull) {
                ev[field] = row[i]
            }
            return ev
        }
    }
}

@MainActor
private final class FixturePlatform: AnalyticsPlatform {
    let clock: any AnalyticsClock
    let storage: any KeyValueStorage = MemoryStorage()
    let fixtureLifecycle = FixtureLifecycle()
    let recordingTransport = RecordingTransport()
    var warnings: [String] = []

    var lifecycle: any AnalyticsLifecycle { fixtureLifecycle }
    var transport: any AnalyticsTransport { recordingTransport }

    init(_ vt: VirtualTime) {
        clock = VirtualClock(vt)
    }

    func log(_ level: AnalyticsLogLevel, _ message: String, _ data: Any?) {
        if level == .warn { warnings.append(message) }
    }

    func getDeviceContext() -> DeviceContext {
        DeviceContext(
            pageUrl: "https://example.com/",
            deviceDisplayWidth: 1920,
            deviceDisplayHeight: 1080,
            deviceDisplayDpr: 1,
            userAgent: "fixture"
        )
    }

    func getPageLoadTimeMs(_ initMonotonicMs: Double) -> Double? {
        0
    }
}

// MARK: - One fixture run

private struct RunOutput {
    var events: [Ev]
    var warnings: [String]
}

@MainActor
private func runFixture(_ fx: Fixture) throws -> RunOutput {
    let vt = VirtualTime()
    let platform = FixturePlatform(vt)
    let player = FakePlayer(vt, fx.player)
    let tracker = createAnalyticsTracker(AnalyticsTrackerOptions(
        config: AnalyticsTrackerUserConfig(userId: "fixture"),
        imagekitId: "fixture",
        player: player,
        platform: platform,
        integration: AnalyticsIntegration(name: "fixture", version: "1")
    ))
    player.emit(.playerReady)

    for s in fx.signals {
        vt.runUntil(s.t)
        try applySignal(s, player, tracker, platform.fixtureLifecycle)
    }
    player.stop()
    vt.runUntil(vt.now + drainMs)
    let decodeWarnings = platform.recordingTransport.decodeFailures.map { "beacon not JSON: \($0)" }
    return RunOutput(events: platform.recordingTransport.events, warnings: platform.warnings + decodeWarnings)
}

private struct UnknownSignal: Error, CustomStringConvertible {
    var type: String
    var description: String { "unknown fixture signal \"\(type)\"" }
}

@MainActor
private func applySignal(
    _ s: FixtureSignal,
    _ player: FakePlayer,
    _ tracker: any AnalyticsTrackerHandle,
    _ lifecycle: FixtureLifecycle
) throws {
    switch s.type {
    case "load_start":
        player.load(s.src ?? player.sourceUrl)
        player.emit(.loadStart(sourceUrl: player.sourceUrl))
    case "play":
        player.emit(.play)
    case "playing":
        player.start()
        player.emit(.playing)
    case "pause":
        player.stop()
        player.emit(.pause)
    case "waiting":
        player.stop()
        player.emit(.waiting)
    case "seeking":
        player.seekTo(s.to ?? 0)
        player.emit(.seeking(fromTime: s.from.map { $0 / 1000 }))
    case "jump":
        player.seekTo(s.to ?? 0)
    case "pause_while_seeking":
        player.pauseWhileSeeking()
    case "seeked":
        player.seekDone()
        player.emit(.seeked)
    case "ended":
        player.stop()
        player.emit(.ended)
    case "error":
        player.stop()
        player.emit(.error(AnalyticsErrorInfo(code: s.code ?? "fixture_error")))
    case "rendition_change":
        player.bitrate = s.bitrate
        player.emit(.renditionChange)
    case "rate":
        player.setRate(s.rate ?? 1)
    case "report_error":
        tracker.reportError(AnalyticsErrorInfo(code: s.code ?? "fixture_reported"))
    case "unload":
        lifecycle.handlers?.onUnload()
    case "suspend":
        lifecycle.handlers?.onSuspend()
    case "hidden":
        lifecycle.handlers?.onHidden()
    case "dispose":
        player.stop()
        player.emit(.dispose)
    case "tracker_dispose":
        tracker.dispose()
    case "restore", "visible", "idle":
        return
    default:
        throw UnknownSignal(type: s.type)
    }
}

// MARK: - Metrics, as playback_agg_mv + dashboard queries compute them

/// Views by `playback_id`, in the order each first appears.
private func groupByPlayback(_ events: [Ev]) -> [[Ev]] {
    var order: [String] = []
    var views: [String: [Ev]] = [:]
    for e in events {
        guard let id = e["playback_id"] as? String, !id.isEmpty else { continue }
        if views[id] == nil { order.append(id) }
        views[id, default: []].append(e)
    }
    return order.map { views[$0]! }
}

/// `typeof v === 'number' && isFinite(v) ? v : 0`
private func num(_ v: Any?) -> Double {
    guard let n = v as? NSNumber, !isBool(n), n.doubleValue.isFinite else { return 0 }
    return n.doubleValue
}

private func isBool(_ n: NSNumber) -> Bool {
    CFGetTypeID(n) == CFBooleanGetTypeID()
}

private func metricsFor(_ evs: [Ev]) -> [String: Any] {
    func of(_ name: String) -> [Ev] { evs.filter { $0["event"] as? String == name } }
    let started = !of("viewstarted").isEmpty
    let hasPlay = !of("play").isEmpty
    let errors = of("error").map { ($0["error_code"] as? String) ?? "" }.filter { !$0.isEmpty }
    let viewstarted = of("viewstarted").first
    // Dashboard startup queries skip warm-resume views (is_resumed_playback = previous_session_id != '').
    let resumed = evs.contains { ($0["previous_session_id"] as? String).map { !$0.isEmpty } ?? false }
    var bitrateWeight: Double = 0
    var bitrateSum: Double = 0
    for e in evs where num(e["bitrate"]) > 0 && num(e["played_delta_ms"]) > 0 {
        bitrateSum += num(e["bitrate"]) * num(e["played_delta_ms"])
        bitrateWeight += num(e["played_delta_ms"])
    }
    let endReasons = of("viewend").map { ($0["view_end_reason"] as? String) ?? "" }.sorted()
    let startupMs: Any = viewstarted.flatMap { vs in
        !resumed && vs["video_startup_time_ms"] != nil ? num(vs["video_startup_time_ms"]) : nil
    } ?? NSNull()
    return [
        "attempt": hasPlay || started || !errors.isEmpty,
        "started": started,
        "exitedBeforeStart": hasPlay && !started && errors.isEmpty,
        "startupFailure": !started && !errors.isEmpty,
        "startupMs": startupMs,
        "playingMs": evs.map { num($0["playing_time_ms"]) }.reduce(0, max),
        "rebufferCount": of("rebufferend").count,
        "rebufferMs": of("rebufferend").reduce(0) { $0 + num($1["rebuffer_duration_ms"]) },
        "seekCount": of("seeked").count,
        "seekMs": of("seeked").reduce(0) { $0 + num($1["seek_time_ms"]) },
        "errors": errors,
        "endReason": endReasons.last ?? "",
        "bitrate": bitrateWeight > 0 ? jsRound(bitrateSum / bitrateWeight) as Any : NSNull(),
        "renditionChanges": of("renditionchange").count,
    ]
}

/// `videochange` is the old view's link record to the next view, sent right after its viewend.
private let allowedAfterViewEnd: Set<String> = ["videochange"]

private func invariantViolations(_ views: [[Ev]]) -> [String] {
    var out: [String] = []
    for (index, evs) in views.enumerated() {
        let v = "view \(index + 1)"
        let name = { (e: Ev) in (e["event"] as? String) ?? "" }
        if let endAt = evs.firstIndex(where: { name($0) == "viewend" }) {
            let after = evs[(endAt + 1)...].filter { !allowedAfterViewEnd.contains(name($0)) }
            if !after.isEmpty {
                out.append("\(v): \(after.count) event(s) after viewend (\(after.map(name).joined(separator: ", ")))")
            }
        }
        let count = { (n: String) in evs.filter { name($0) == n }.count }
        if count("viewend") > 1 { out.append("\(v): \(count("viewend")) viewend") }
        if count("viewstarted") > 1 { out.append("\(v): \(count("viewstarted")) viewstarted") }
        let sessions = Set(evs.map { ($0["session_id"] as? String) ?? "" })
        if sessions.count > 1 { out.append("\(v): events split across \(sessions.count) session_ids") }
        var open = false
        for e in evs {
            if name(e) == "rebufferstart" {
                if open { out.append("\(v): rebufferstart while one is open") }
                open = true
            } else if name(e) == "rebufferend" {
                if !open { out.append("\(v): rebufferend without rebufferstart") }
                open = false
            }
        }
        if open { out.append("\(v): rebufferstart never closed") }
        var playing = false
        for e in evs {
            if name(e) == "playing" {
                playing = true
            } else if ["pause", "ended", "error"].contains(name(e)) {
                playing = false
            } else if name(e) == "timeupdate" && !playing {
                out.append("\(v): timeupdate while not playing")
            }
            if name(e) == "timeupdate" && !(num(e["played_delta_ms"]) > 0) {
                out.append("\(v): timeupdate with nothing played")
            }
        }
        var last: Double = -1
        for e in evs {
            guard let n = e["playing_time_ms"] as? NSNumber, !isBool(n) else { continue }
            if n.doubleValue < last { out.append("\(v): playing_time_ms went down (\(last) → \(n.doubleValue))") }
            last = n.doubleValue
        }
    }
    return out
}

// MARK: - Rows: every row sent, normalized so runs and platforms compare equal

private let rowIdFields: [String: String] = [
    "next_playback_id": "v",
    "previous_playback_id": "v",
    "previous_session_id": "s",
]
private let rowOmitted: Set<String> = ["event_time", "event_order", "event_id", "event", "playback_id"]
// Constant within a view, so kept only when they change, to keep the rows short.
private let rowMediaFields: Set<String> = [
    "video_source_url",
    "video_source_type",
    "video_width_pixels",
    "video_height_pixels",
    "video_total_duration_ms",
    "video_upscale_percentage",
    "video_downscale_percentage",
    "audio_codec",
    "video_codec",
]

private func fixtureRows(_ events: [Ev]) throws -> [[String: Any]] {
    var aliases: [String: String] = [:]
    var counts = ["v": 0, "s": 0]
    func alias(_ kind: String, _ id: Any?) -> String {
        guard let id = id as? String, !id.isEmpty else { return "-" }
        let key = "\(kind):\(id)"
        if aliases[key] == nil {
            counts[kind]! += 1
            aliases[key] = "\(kind)\(counts[kind]!)"
        }
        return aliases[key]!
    }
    var lastMedia: [String: [String: String]] = [:]

    return try events.map { e in
        let view = alias("v", e["playback_id"])
        var media = lastMedia[view] ?? [:]
        var row: [String: Any] = [
            "t": num(e["event_time"]) - epochMs,
            "view": view,
            "session": alias("s", e["session_id"]),
            "order": e["event_order"] ?? NSNull(),
            "event": e["event"] ?? NSNull(),
        ]
        for field in eventFieldsV1 {
            guard !rowOmitted.contains(field), let value = e[field], !(value is NSNull) else { continue }
            let shown: Any = rowIdFields[field].map { alias($0, value) } ?? value
            if rowMediaFields.contains(field) {
                let key = try jsonStringify([shown])
                if media[field] == key { continue }
                media[field] = key
            }
            row[field] = shown
        }
        lastMedia[view] = media
        return row
    }
}

/// Deep equality of decoded JSON values; numbers compare by value, booleans only with booleans.
func jsonEqual(_ a: Any?, _ b: Any?) -> Bool {
    switch (a, b) {
    case (nil, nil), (is NSNull, is NSNull), (nil, is NSNull), (is NSNull, nil):
        return true
    case let (x as String, y as String):
        return x == y
    case let (x as NSNumber, y as NSNumber):
        return isBool(x) == isBool(y) && x.doubleValue == y.doubleValue
    case let (x as [Any], y as [Any]):
        return x.count == y.count && zip(x, y).allSatisfy { jsonEqual($0, $1) }
    case let (x as [String: Any], y as [String: Any]):
        return Set(x.keys) == Set(y.keys) && x.allSatisfy { jsonEqual($0.value, y[$0.key]) }
    default:
        return false
    }
}

/// Swift values as `JSONSerialization` decodes them, so both sides of a comparison have the same types.
func decoded(_ value: Any) throws -> Any {
    let json = try jsonStringify([value])
    return (try JSONSerialization.jsonObject(with: Data(json.utf8)) as! [Any])[0]
}

func render(_ value: Any?) -> String {
    guard let value, !(value is NSNull) else { return "null" }
    guard let data = try? JSONSerialization.data(
        withJSONObject: [value],
        options: [.sortedKeys, .withoutEscapingSlashes, .fragmentsAllowed]
    ) else { return "\(value)" }
    return String(String(decoding: data, as: UTF8.self).dropFirst().dropLast())
}

private func diffRows(_ expected: [[String: Any]]?, _ actual: [[String: Any]]) -> [String] {
    guard let expected else { return ["rows: none in the fixture"] }
    let at = (0..<min(expected.count, actual.count)).first { !jsonEqual(expected[$0], actual[$0]) }
    if at == nil && expected.count == actual.count { return [] }
    let i = at ?? min(expected.count, actual.count)
    return [
        "rows: row \(i + 1) differs (\(expected.count) rows expected, \(actual.count) sent)",
        "  expected: \(i < expected.count ? render(expected[i]) : "(none)")",
        "  sent:     \(i < actual.count ? render(actual[i]) : "(none)")",
    ]
}

private func diffViews(_ expected: [[String: Any]], _ actual: [[String: Any]]) -> [String] {
    var out: [String] = []
    if expected.count != actual.count { out.append("views: expected \(expected.count), got \(actual.count)") }
    for i in 0..<min(expected.count, actual.count) {
        let want = viewDefaults().merging(expected[i]) { $1 }
        for key in want.keys.sorted() where !jsonEqual(want[key], actual[i][key]) {
            out.append("view \(i + 1) \(key): expected \(render(want[key])), got \(render(actual[i][key]))")
        }
    }
    return out
}

// MARK: - Tests

final class FixtureRunnerTests: XCTestCase {
    /// The fixtures are read from the repo, which a simulator test cannot do without a privacy prompt.
    override func setUpWithError() throws {
        #if !os(macOS)
        throw XCTSkip("reads the fixtures from the repo; runs on macOS")
        #endif
    }

    @MainActor
    private func runFile(_ name: String, expectedCount: Int) throws {
        let fixtures = try loadFixtures(name)
        XCTAssertEqual(fixtures.count, expectedCount, "\(name): fixture count")
        for fx in fixtures {
            let output = try runFixture(fx)
            let views = groupByPlayback(output.events)
            let actual = try views.map { try decoded(metricsFor($0)) as! [String: Any] }
            let sentRows = try fixtureRows(output.events).map { try decoded($0) as! [String: Any] }
            // A known bug's rows are wrong by definition, so it has none.
            let rowProblems = fx.knownBug != nil ? [] : diffRows(fx.rows, sentRows)
            let problems = diffViews(fx.expected, actual)
                + invariantViolations(views)
                + output.warnings.map { "warning: \($0)" }
                + rowProblems
            if let knownBug = fx.knownBug {
                if problems.isEmpty {
                    XCTFail("\(fx.id) \(fx.title): passes now; remove \"knownBug\" from the fixture (\(knownBug))")
                }
                continue
            }
            for problem in problems {
                XCTFail("\(fx.id) \(fx.title): \(problem)")
            }
        }
    }

    @MainActor
    func testViews() throws {
        try runFile("views.json", expectedCount: 9)
    }

    @MainActor
    func testPlayingTime() throws {
        try runFile("playing-time.json", expectedCount: 8)
    }

    @MainActor
    func testRebuffering() throws {
        try runFile("rebuffering.json", expectedCount: 8)
    }

    @MainActor
    func testSeeking() throws {
        try runFile("seeking.json", expectedCount: 10)
    }

    @MainActor
    func testLifecycle() throws {
        try runFile("lifecycle.json", expectedCount: 9)
    }

    func testFixtureFilesAreAllRun() throws {
        let onDisk = try FileManager.default.contentsOfDirectory(atPath: fixturesDirectory.path)
            .filter { $0.hasSuffix(".json") }
        XCTAssertEqual(Set(onDisk), Set(fixtureFiles))
        let total = try fixtureFiles.reduce(0) { $0 + (try loadFixtures($1)).count }
        XCTAssertEqual(total, 44)
    }

    /// The TS runner replaces the global timers; here the sources are checked for any timer that
    /// bypasses `clock.schedule`.
    func testCoreSchedulesOnlyThroughTheClock() throws {
        let sources = fixturesDirectory
            .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
            .appendingPathComponent("video-analytics-ios/Sources/ImageKitVideoAnalyticsCore")
        let files = try FileManager.default.contentsOfDirectory(atPath: sources.path).filter { $0.hasSuffix(".swift") }
        XCTAssertFalse(files.isEmpty)
        for file in files {
            let text = try String(contentsOf: sources.appendingPathComponent(file), encoding: .utf8)
            for pattern in [#"DispatchQueue"#, #"asyncAfter"#, #"(?<![A-Za-z])Timer\b"#, #"RunLoop"#, #"Task\.sleep"#, #"usleep"#] {
                XCTAssertNil(
                    text.range(of: pattern, options: .regularExpression),
                    "\(file) matches \(pattern); timers must go through clock.schedule"
                )
            }
        }
    }
}
