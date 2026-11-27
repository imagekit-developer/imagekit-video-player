import XCTest
@testable import ImageKitVideoAnalytics

final class PlatformSupportTests: XCTestCase {
    func testSafariStyleUserAgent() {
        XCTAssertEqual(
            safariStyleUserAgent(isPad: false, osVersion: "26.5", appName: "Swiggy", appVersion: "4.12.1"),
            "Mozilla/5.0 (iPhone; CPU iPhone OS 26_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Swiggy/4.12.1"
        )
        XCTAssertEqual(
            safariStyleUserAgent(isPad: true, osVersion: "18.1.1", appName: "My App (Beta)", appVersion: ""),
            "Mozilla/5.0 (iPad; CPU OS 18_1_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) MyAppBeta/0"
        )
        XCTAssertTrue(
            safariStyleUserAgent(isPad: false, osVersion: "17.0", appName: "", appVersion: "1").hasSuffix(" App/1")
        )
    }

    @MainActor
    func testClockAndStorage() {
        let clock = SystemClock()
        XCTAssertEqual(clock.now(), clock.now().rounded(.down))
        let a = clock.monotonicNow()
        XCTAssertGreaterThanOrEqual(clock.monotonicNow(), a)
        clock.pinnedMonotonicMs = 5
        XCTAssertEqual(clock.monotonicNow(), 5)

        let storage = InMemoryStorage.shared
        storage.setItem("k", "v")
        XCTAssertEqual(storage.getItem("k"), "v")
        storage.removeItem("k")
        XCTAssertNil(storage.getItem("k"))
    }

    @MainActor
    func testScheduleRunsOnMainAndCancels() {
        let clock = SystemClock()
        let ran = expectation(description: "ran")
        var cancelledRan = false
        _ = clock.schedule({ ran.fulfill() }, delayMs: 10)
        let cancel = clock.schedule({ cancelledRan = true }, delayMs: 10)
        cancel()
        wait(for: [ran], timeout: 2)
        RunLoop.main.run(until: Date().addingTimeInterval(0.05))
        XCTAssertFalse(cancelledRan)
    }
}
