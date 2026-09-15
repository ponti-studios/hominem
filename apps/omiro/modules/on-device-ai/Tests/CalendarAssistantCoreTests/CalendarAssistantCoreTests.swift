import Foundation
import Testing
@testable import CalendarAssistantCore

private func date(_ value: String) -> Date {
  ISO8601DateFormatter().date(from: value)!
}

@Test("availability merges calendar and task busy intervals")
func availabilityMergesBusyIntervals() throws {
  let openings = try CalendarAvailability.openings(
    events: [CalendarEventSummary(id: "event", title: "Event", startDate: date("2026-09-15T10:00:00Z"), endDate: date("2026-09-15T11:00:00Z"))],
    taskBusyIntervals: [TaskBusyInterval(startDate: date("2026-09-15T09:00:00Z"), endDate: date("2026-09-15T10:30:00Z"))],
    from: date("2026-09-15T08:00:00Z"),
    to: date("2026-09-15T12:00:00Z"),
    durationMinutes: 60
  )

  #expect(openings == [AvailabilityChoice(startDate: date("2026-09-15T08:00:00Z"), endDate: date("2026-09-15T09:00:00Z")), AvailabilityChoice(startDate: date("2026-09-15T11:00:00Z"), endDate: date("2026-09-15T12:00:00Z"))])
}

@Test("availability rejects invalid requests")
func availabilityRejectsInvalidRequests() {
  let timestamp = Date()
  #expect(throws: CalendarAssistantError.invalidDateRange) {
    try CalendarAvailability.openings(events: [], taskBusyIntervals: [], from: timestamp, to: timestamp, durationMinutes: 30)
  }
}
