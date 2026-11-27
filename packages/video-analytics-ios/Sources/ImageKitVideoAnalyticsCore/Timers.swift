/// Runs `fn` every `everyMs` until the returned function is called.
@MainActor
package func scheduleRepeating(
    _ clock: any AnalyticsClock,
    _ fn: @escaping @MainActor () -> Void,
    everyMs: Double
) -> @MainActor () -> Void {
    let loop = RepeatingLoop(clock: clock, fn: fn, everyMs: everyMs)
    loop.next()
    return { loop.cancelNext() }
}

@MainActor
private final class RepeatingLoop {
    let clock: any AnalyticsClock
    let fn: @MainActor () -> Void
    let everyMs: Double
    var cancelNext: @MainActor () -> Void = {}

    init(clock: any AnalyticsClock, fn: @escaping @MainActor () -> Void, everyMs: Double) {
        self.clock = clock
        self.fn = fn
        self.everyMs = everyMs
    }

    func next() {
        cancelNext = clock.schedule({ [self] in
            // Scheduled first so `fn` can stop the loop.
            next()
            fn()
        }, delayMs: everyMs)
    }
}
