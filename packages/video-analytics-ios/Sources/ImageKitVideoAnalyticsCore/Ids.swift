import Foundation

private let base36Digits = Array("0123456789abcdefghijklmnopqrstuvwxyz")

/// `Math.random().toString(36).slice(2, 2 + count)`.
func randomBase36(_ count: Int) -> String {
    String((0..<count).map { _ in base36Digits[Int.random(in: 0..<36)] })
}

/// `Date.now()`.
func dateNowMs() -> Int64 {
    Int64((Date().timeIntervalSince1970 * 1000).rounded(.down))
}

package func randomId() -> String {
    "\(dateNowMs())-\(randomBase36(9))"
}

package func createPlayerInstanceId() -> String {
    randomId()
}

/// One per view.
package func createPlaybackId() -> String {
    randomId()
}

package func createEventId() -> String {
    randomId()
}
