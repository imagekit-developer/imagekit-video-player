// swift-tools-version:6.0
import PackageDescription

let package = Package(
    name: "ImageKitVideoAnalytics",
    platforms: [.iOS(.v15), .macOS(.v12)],
    products: [
        .library(name: "ImageKitVideoAnalytics", targets: ["ImageKitVideoAnalytics"]),
    ],
    targets: [
        .target(
            name: "ImageKitVideoAnalyticsCore",
            path: "packages/video-analytics-ios/Sources/ImageKitVideoAnalyticsCore"
        ),
        .target(
            name: "ImageKitVideoAnalytics",
            dependencies: ["ImageKitVideoAnalyticsCore"],
            path: "packages/video-analytics-ios/Sources/ImageKitVideoAnalytics",
            resources: [.copy("Resources/PrivacyInfo.xcprivacy")]
        ),
        .testTarget(
            name: "ImageKitVideoAnalyticsCoreTests",
            dependencies: ["ImageKitVideoAnalyticsCore"],
            path: "packages/video-analytics-ios/Tests/ImageKitVideoAnalyticsCoreTests"
        ),
        .testTarget(
            name: "ImageKitVideoAnalyticsTests",
            dependencies: ["ImageKitVideoAnalytics", "ImageKitVideoAnalyticsCore"],
            path: "packages/video-analytics-ios/Tests/ImageKitVideoAnalyticsTests"
        ),
    ],
    swiftLanguageModes: [.v6]
)
