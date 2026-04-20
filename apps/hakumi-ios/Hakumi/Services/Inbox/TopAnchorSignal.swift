import Foundation

// MARK: - TopAnchorSignal
//
// Explicit scroll-to-top signal for the inbox feed.
// Mirrors the Expo `top-anchored-feed.tsx` state model.
//
// Callers that want to reveal new top content (e.g. composer submit,
// note save) call `TopAnchorSignal.inbox.request()`.
// The inbox screen observes `hasPendingReveal` and scrolls to top,
// then calls `markHandled()` to consume the signal.
//
// pendingRequestId > handledRequestId  →  scroll to top is pending
// pendingRequestId == handledRequestId →  no pending scroll

@Observable
@MainActor
final class TopAnchorSignal {

    // MARK: - Shared instances

    static let inbox = TopAnchorSignal()
    static let notes = TopAnchorSignal()

    // MARK: - State

    private(set) var pendingRequestId: Int = 0
    private(set) var handledRequestId: Int = 0

    var hasPendingReveal: Bool { pendingRequestId > handledRequestId }

    // MARK: - Mutations

    /// Request a scroll-to-top on the next focused render.
    func request() {
        pendingRequestId += 1
    }

    /// Consume the pending scroll request once handled.
    func markHandled() {
        guard hasPendingReveal else { return }
        handledRequestId = pendingRequestId
    }
}
