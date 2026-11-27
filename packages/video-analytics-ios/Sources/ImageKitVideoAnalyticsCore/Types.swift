import Foundation

package enum IKAnalyticsEventName: String, Sendable {
    case sessioninit
    case playerready
    case viewinit
    case viewstarted
    case videochange
    case play
    case playing
    case pause
    case timeupdate
    case seeking
    case seeked
    case rebufferstart
    case rebufferend
    case renditionchange
    case error
    case ended
    case viewend
}

package enum VideoSourceType: String, Sendable {
    case hls
    case dash
    case mp4
    case webm
    case other
}

package enum ViewEndReason: String, Sendable {
    case videochange
    case error
    case dispose
    case navigation
    case sessionrotate
}

/// The batch context, shared by reference like the TS object: a flush encodes it as it is then.
@MainActor
package final class IKAnalyticsClientContext {
    package var imagekitId: String
    package var sessionId: String
    package var playerInstanceId: String
    package var userId: String?
    package var pageUrl: String
    package var deviceDisplayWidth: Double
    package var deviceDisplayHeight: Double
    package var deviceDisplayDpr: Double
    package var userAgent: String
    /// YYYY-MM-DD
    package var sessionStartDate: String
    package var sessionStartTimeIso: String?
    package var playerHeightPixels: Double?
    package var playerWidthPixels: Double?
    package var playerAutoplay: Bool?
    package var playerPreload: String?
    package var playerSoftware: String?
    package var playerSoftwareVersion: String?
    package var imagekitPlugin: String?
    package var imagekitPluginVersion: String?
    /// Per-session custom dimensions, keyed by slot code (`cd_1`, `cd_2`, …).
    /// Slot codes are allocated in the dashboard (Settings → Video Analytics →
    /// Custom Dimensions). Stored verbatim on the server in the matching slot.
    package var customDimensions: [String: String]?
    /// Only sent when true (host driven by automation).
    package var webdriver: Bool?

    package init(
        imagekitId: String,
        sessionId: String,
        playerInstanceId: String,
        userId: String?,
        pageUrl: String,
        deviceDisplayWidth: Double,
        deviceDisplayHeight: Double,
        deviceDisplayDpr: Double,
        userAgent: String,
        sessionStartDate: String,
        sessionStartTimeIso: String?,
        playerSoftware: String?,
        playerSoftwareVersion: String?,
        imagekitPlugin: String?,
        imagekitPluginVersion: String?,
        customDimensions: [String: String]?,
        webdriver: Bool?
    ) {
        self.imagekitId = imagekitId
        self.sessionId = sessionId
        self.playerInstanceId = playerInstanceId
        self.userId = userId
        self.pageUrl = pageUrl
        self.deviceDisplayWidth = deviceDisplayWidth
        self.deviceDisplayHeight = deviceDisplayHeight
        self.deviceDisplayDpr = deviceDisplayDpr
        self.userAgent = userAgent
        self.sessionStartDate = sessionStartDate
        self.sessionStartTimeIso = sessionStartTimeIso
        self.playerSoftware = playerSoftware
        self.playerSoftwareVersion = playerSoftwareVersion
        self.imagekitPlugin = imagekitPlugin
        self.imagekitPluginVersion = imagekitPluginVersion
        self.customDimensions = customDimensions
        self.webdriver = webdriver
    }

    /// Every field under its canonical (long) wire name; `nil` is undefined.
    func entries() -> [(String, Any?)] {
        [
            ("imagekit_id", imagekitId),
            ("session_id", sessionId),
            ("player_instance_id", playerInstanceId),
            ("user_id", userId),
            ("page_url", pageUrl),
            ("device_display_width", deviceDisplayWidth),
            ("device_display_height", deviceDisplayHeight),
            ("device_display_dpr", deviceDisplayDpr),
            ("user_agent", userAgent),
            ("session_start_date", sessionStartDate),
            ("session_start_time_iso", sessionStartTimeIso),
            ("player_height_pixels", playerHeightPixels),
            ("player_width_pixels", playerWidthPixels),
            ("player_autoplay", playerAutoplay),
            ("player_preload", playerPreload),
            ("player_software", playerSoftware),
            ("player_software_version", playerSoftwareVersion),
            ("imagekit_plugin", imagekitPlugin),
            ("imagekit_plugin_version", imagekitPluginVersion),
            ("custom_dimensions", customDimensions),
            ("webdriver", webdriver),
        ]
    }
}

/// One event as the state machine emits it. Fields map to the wire names (`eventFieldsV1`);
/// empty strings and missing values are sent as null.
package struct AnalyticsEvent {
    package var event: IKAnalyticsEventName
    package var eventId: String
    package var playbackId: String
    package var previousPlaybackId: String?
    package var previousSessionId: String?
    package var videoSourceUrl: String?
    package var videoWidthPixels: Double?
    package var videoHeightPixels: Double?
    package var videoTotalDurationMs: Double?
    package var videoStartupTimeMs: Double?
    package var pageLoadTimeMs: Double?
    package var playerStartupTimeMs: Double?
    package var playbackTimeInstantMs: Double?
    package var playingTimeMs: Double?
    package var videoUpscalePercentage: Double?
    package var videoDownscalePercentage: Double?
    package var bitrate: Double?
    package var audioCodec: String?
    package var videoCodec: String?
    package var fromPositionMs: Double?
    package var toPositionMs: Double?
    package var seekTimeMs: Double?
    package var rebufferDurationMs: Double?
    package var errorCode: String?
    package var errorMessage: String?
    package var errorContext: String?
    package var playedDeltaMs: Double?
    package var viewEndReason: ViewEndReason?
    package var newVideoSourceUrl: String?
    package var nextPlaybackId: String?
    /// Position of the event in its view, from 1.
    package var eventOrder: Int
    package var previousEvent: IKAnalyticsEventName?
    package var msFromPreviousEvent: Double

    init(
        event: IKAnalyticsEventName,
        eventId: String,
        playbackId: String,
        eventOrder: Int,
        previousEvent: IKAnalyticsEventName?,
        msFromPreviousEvent: Double
    ) {
        self.event = event
        self.eventId = eventId
        self.playbackId = playbackId
        self.eventOrder = eventOrder
        self.previousEvent = previousEvent
        self.msFromPreviousEvent = msFromPreviousEvent
    }

    /// Object spread (`{ ...event, ...fields }`): every field present in `fields` overwrites, even with undefined.
    mutating func apply(_ fields: AnalyticsEventFields) {
        if let v = fields.previousPlaybackId { previousPlaybackId = v }
        if let v = fields.previousSessionId { previousSessionId = v }
        if let v = fields.videoSourceUrl { videoSourceUrl = v }
        if let v = fields.videoWidthPixels { videoWidthPixels = v }
        if let v = fields.videoHeightPixels { videoHeightPixels = v }
        if let v = fields.videoTotalDurationMs { videoTotalDurationMs = v }
        if let v = fields.videoStartupTimeMs { videoStartupTimeMs = v }
        if let v = fields.pageLoadTimeMs { pageLoadTimeMs = v }
        if let v = fields.playerStartupTimeMs { playerStartupTimeMs = v }
        if let v = fields.playbackTimeInstantMs { playbackTimeInstantMs = v }
        if let v = fields.playingTimeMs { playingTimeMs = v }
        if let v = fields.videoUpscalePercentage { videoUpscalePercentage = v }
        if let v = fields.videoDownscalePercentage { videoDownscalePercentage = v }
        if let v = fields.bitrate { bitrate = v }
        if let v = fields.audioCodec { audioCodec = v }
        if let v = fields.videoCodec { videoCodec = v }
        if let v = fields.fromPositionMs { fromPositionMs = v }
        if let v = fields.toPositionMs { toPositionMs = v }
        if let v = fields.seekTimeMs { seekTimeMs = v }
        if let v = fields.rebufferDurationMs { rebufferDurationMs = v }
        if let v = fields.errorCode { errorCode = v }
        if let v = fields.errorMessage { errorMessage = v }
        if let v = fields.errorContext { errorContext = v }
        if let v = fields.playedDeltaMs { playedDeltaMs = v }
        if let v = fields.viewEndReason { viewEndReason = v }
        if let v = fields.newVideoSourceUrl { newVideoSourceUrl = v }
        if let v = fields.nextPlaybackId { nextPlaybackId = v }
    }

    /// The value at a `eventFieldsV1` position; `nil` when undefined.
    func wireValue(_ field: String) -> Any? {
        switch field {
        case "event_order": return Double(eventOrder)
        case "event_id": return eventId
        case "event": return event.rawValue
        case "previous_event": return previousEvent?.rawValue
        case "ms_from_previous_event": return msFromPreviousEvent
        case "playback_id": return playbackId
        case "video_source_url": return videoSourceUrl
        case "video_width_pixels": return videoWidthPixels
        case "video_height_pixels": return videoHeightPixels
        case "video_total_duration_ms": return videoTotalDurationMs
        case "playback_time_instant_ms": return playbackTimeInstantMs
        case "playing_time_ms": return playingTimeMs
        case "video_upscale_percentage": return videoUpscalePercentage
        case "video_downscale_percentage": return videoDownscalePercentage
        case "from_position_ms": return fromPositionMs
        case "to_position_ms": return toPositionMs
        case "seek_time_ms": return seekTimeMs
        case "bitrate": return bitrate
        case "played_delta_ms": return playedDeltaMs
        case "rebuffer_duration_ms": return rebufferDurationMs
        case "error_code": return errorCode
        case "error_message": return errorMessage
        case "view_end_reason": return viewEndReason?.rawValue
        case "new_video_source_url": return newVideoSourceUrl
        case "next_playback_id": return nextPlaybackId
        case "video_startup_time_ms": return videoStartupTimeMs
        case "player_startup_time_ms": return playerStartupTimeMs
        case "page_load_time_ms": return pageLoadTimeMs
        case "audio_codec": return audioCodec
        case "video_codec": return videoCodec
        case "error_context": return errorContext
        case "previous_playback_id": return previousPlaybackId
        case "previous_session_id": return previousSessionId
        default: return nil
        }
    }
}

/// `Partial<AnalyticsEvent>` with JS key presence: `nil` is an absent key, `.some(nil)` a key set to undefined.
/// Assigning an optional value (`videoSourceUrl: url` with `url: String?`) sets the key even when the value is nil.
package struct AnalyticsEventFields {
    var previousPlaybackId: String?? = nil
    var previousSessionId: String?? = nil
    var videoSourceUrl: String?? = nil
    var videoWidthPixels: Double?? = nil
    var videoHeightPixels: Double?? = nil
    var videoTotalDurationMs: Double?? = nil
    var videoStartupTimeMs: Double?? = nil
    var pageLoadTimeMs: Double?? = nil
    var playerStartupTimeMs: Double?? = nil
    var playbackTimeInstantMs: Double?? = nil
    var playingTimeMs: Double?? = nil
    var videoUpscalePercentage: Double?? = nil
    var videoDownscalePercentage: Double?? = nil
    var bitrate: Double?? = nil
    var audioCodec: String?? = nil
    var videoCodec: String?? = nil
    var fromPositionMs: Double?? = nil
    var toPositionMs: Double?? = nil
    var seekTimeMs: Double?? = nil
    var rebufferDurationMs: Double?? = nil
    var errorCode: String?? = nil
    var errorMessage: String?? = nil
    var errorContext: String?? = nil
    var playedDeltaMs: Double?? = nil
    var viewEndReason: ViewEndReason?? = nil
    var newVideoSourceUrl: String?? = nil
    var nextPlaybackId: String?? = nil
}

package enum FlushReason: String, Sendable {
    case interval
    case visibilityHidden = "visibility_hidden"
    case pagehide
    case manual
    case dispose
    case sizeLimit = "size_limit"
    case bufferFull = "buffer_full"
}

// MARK: - JavaScript number semantics

/// `Math.round`: halves round up, toward +∞ (Swift's `.rounded()` rounds them away from zero).
package func jsRound(_ x: Double) -> Double {
    let floor = x.rounded(.down)
    return x - floor >= 0.5 ? floor + 1 : floor
}

/// `String(x)` for the numbers the core stores as text (whole ms).
func jsNumberString(_ x: Double) -> String {
    if x.isFinite, x == x.rounded(.towardZero), abs(x) < 1e15 { return String(Int64(x)) }
    return x.isNaN ? "NaN" : String(x)
}

/// `x || undefined` for a number: 0 and NaN are falsy.
func jsTruthyNumber(_ x: Double?) -> Double? {
    guard let x, x != 0, !x.isNaN else { return nil }
    return x
}
