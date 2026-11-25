package struct AnalyticsErrorInfo: Sendable {
    package var code: String
    package var message: String?
    package var context: String?

    package init(code: String, message: String? = nil, context: String? = nil) {
        self.code = code
        self.message = message
        self.context = context
    }
}

package enum PlayerSignal: Sendable {
    case playerReady
    /// `sourceUrl` is the URL being played, reported on every row. `sourceKey` identifies the source
    /// the app asked for; a new view is a video change when it differs. Defaults to `sourceUrl`.
    case loadStart(sourceUrl: String, sourceKey: String? = nil)
    case play
    case playing
    case pause
    case timeupdate
    /// `fromTime`: where the seek left from, in seconds. Send it when the jump is only noticed after the
    /// playhead moved (AVPlayer); without it the tracker estimates it from the last playhead it saw.
    case seeking(fromTime: Double? = nil)
    case seeked
    case waiting
    /// A different rendition is on screen (e.g. the decoded frame size changed).
    case renditionChange
    case ended
    case error(AnalyticsErrorInfo)
    case dispose
}

/// Point-in-time playback readings. Times are in seconds, as players report them.
package struct PlaybackSnapshot: Sendable {
    package var videoWidth: Double?
    package var videoHeight: Double?
    package var duration: Double?
    package var upscalePercentage: Double?
    package var downscalePercentage: Double?
    package var audioCodec: String?
    package var videoCodec: String?

    package init(
        videoWidth: Double? = nil,
        videoHeight: Double? = nil,
        duration: Double? = nil,
        upscalePercentage: Double? = nil,
        downscalePercentage: Double? = nil,
        audioCodec: String? = nil,
        videoCodec: String? = nil
    ) {
        self.videoWidth = videoWidth
        self.videoHeight = videoHeight
        self.duration = duration
        self.upscalePercentage = upscalePercentage
        self.downscalePercentage = downscalePercentage
        self.audioCodec = audioCodec
        self.videoCodec = videoCodec
    }
}

/// Rendered player box (not the video resolution) and startup settings.
package struct PlayerUiContext: Sendable {
    package var width: Double?
    package var height: Double?
    package var autoplay: Bool?
    package var preload: String?

    package init(width: Double? = nil, height: Double? = nil, autoplay: Bool? = nil, preload: String? = nil) {
        self.width = width
        self.height = height
        self.autoplay = autoplay
        self.preload = preload
    }
}

/// Binding between one concrete player (AVPlayer …) and the tracker. Signals must already be
/// de-noised: no pause emitted while seeking. Forward every `seeking` of a drag; the tracker counts
/// them as one seek, timed from the last.
@MainActor
package protocol AnalyticsPlayer: AnyObject {
    var software: String { get }
    var softwareVersion: String { get }
    func subscribe(_ listener: @escaping @MainActor (PlayerSignal) -> Void) -> @MainActor () -> Void
    func getUiContext() -> PlayerUiContext
    func getSnapshot() -> PlaybackSnapshot
    func getCurrentTime() -> Double?
    /// Playback speed, 1 = normal.
    func getPlaybackRate() -> Double?
    /// Bits per second of the rendition on screen, which can lag the one being downloaded.
    func getBitrate() -> Double?
    /// Drop per-source detections (codecs, bitrate) because a new source is loading.
    func resetSourceState()
}
