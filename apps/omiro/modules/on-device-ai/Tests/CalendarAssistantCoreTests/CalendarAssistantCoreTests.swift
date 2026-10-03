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

private func event(_ id: String, _ title: String, _ start: String) -> CalendarEventSummary {
  CalendarEventSummary(id: id, title: title, startDate: date(start), endDate: date(start).addingTimeInterval(3600))
}

@Test("matcher finds an event from a command-style sentence and ignores command words")
func matcherIgnoresCommandWords() {
  let events = [
    event("a", "Dentist appointment", "2026-09-15T15:00:00Z"),
    event("b", "Team sync", "2026-09-16T09:00:00Z"),
  ]
  #expect(CalendarEventMatcher.matches(events: events, query: "Cancel my dentist appointment").map(\.id) == ["a"])
}

@Test("matcher ranks exact titles first, then earlier events")
func matcherRanksExactThenEarliest() {
  let events = [
    event("later", "Design review", "2026-09-18T10:00:00Z"),
    event("exact", "Review", "2026-09-19T10:00:00Z"),
    event("earlier", "Design review", "2026-09-16T10:00:00Z"),
  ]
  #expect(CalendarEventMatcher.matches(events: events, query: "review").map(\.id) == ["exact", "earlier", "later"])
}

@Test("matcher folds case and diacritics and rejects weak matches")
func matcherFoldsAndRejects() {
  let events = [event("a", "Café with Priya", "2026-09-15T08:00:00Z"), event("b", "Gym", "2026-09-15T18:00:00Z")]
  #expect(CalendarEventMatcher.matches(events: events, query: "CAFE").map(\.id) == ["a"])
  #expect(CalendarEventMatcher.matches(events: events, query: "board meeting offsite").isEmpty)
  #expect(CalendarEventMatcher.matches(events: events, query: "move my").isEmpty)
}
