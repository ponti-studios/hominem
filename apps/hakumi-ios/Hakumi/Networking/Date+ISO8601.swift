import Foundation

// MARK: - ISO 8601 date parsing
//
// Shared helper used by ChatService, NoteService, and InboxService.
// Tries fractional-seconds format first (most common from the API),
// then falls back to plain internet-date-time format.

extension Date {
    static func fromISO8601(_ string: String) -> Date? {
        if let d = _withFrac.date(from: string) { return d }
        return _noFrac.date(from: string)
    }
}

// Module-level formatters so they are created once and reused.
// nonisolated(unsafe) is required because ISO8601DateFormatter is not Sendable in Swift 6,
// but these instances are read-only after initialisation and therefore safe to share.
nonisolated(unsafe) private let _withFrac: ISO8601DateFormatter = {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return f
}()

nonisolated(unsafe) private let _noFrac: ISO8601DateFormatter = {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime]
    return f
}()
