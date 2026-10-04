import Foundation

public struct CalendarEventSummary: Codable, Equatable, Sendable, Identifiable {
  public let id: String
  public let title: String
  public let startDate: Date
  public let endDate: Date
  public let isAllDay: Bool
  public let location: String?
  public let calendarTitle: String?
  public let isEditable: Bool

  public init(
    id: String,
    title: String,
    startDate: Date,
    endDate: Date,
    isAllDay: Bool = false,
    location: String? = nil,
    calendarTitle: String? = nil,
    isEditable: Bool = false
  ) {
    self.id = id
    self.title = title
    self.startDate = startDate
    self.endDate = endDate
    self.isAllDay = isAllDay
    self.location = location
    self.calendarTitle = calendarTitle
    self.isEditable = isEditable
  }
}

public struct CalendarDraft: Codable, Equatable, Sendable {
  public let title: String
  public let startDate: Date
  public let endDate: Date
  public let isAllDay: Bool
  public let location: String?
  public let notes: String?
  public let recurrenceRule: String?

  public init(
    title: String,
    startDate: Date,
    endDate: Date,
    isAllDay: Bool = false,
    location: String? = nil,
    notes: String? = nil,
    recurrenceRule: String? = nil
  ) {
    self.title = title
    self.startDate = startDate
    self.endDate = endDate
    self.isAllDay = isAllDay
    self.location = location
    self.notes = notes
    self.recurrenceRule = recurrenceRule
  }
}

public struct TaskBusyInterval: Codable, Equatable, Sendable {
  public let startDate: Date
  public let endDate: Date

  public init(startDate: Date, endDate: Date) {
    self.startDate = startDate
    self.endDate = endDate
  }
}

public struct AvailabilityChoice: Codable, Equatable, Sendable, Identifiable {
  public let startDate: Date
  public let endDate: Date
  public var id: String { "\(startDate.timeIntervalSince1970)-\(endDate.timeIntervalSince1970)" }

  public init(startDate: Date, endDate: Date) {
    self.startDate = startDate
    self.endDate = endDate
  }
}

public enum CalendarAssistantError: Error, Equatable, Sendable {
  case invalidDateRange
}

public enum CalendarAvailability {
  public static func openings(
    events: [CalendarEventSummary],
    taskBusyIntervals: [TaskBusyInterval],
    from startDate: Date,
    to endDate: Date,
    durationMinutes: Int,
    limit: Int = 5
  ) throws -> [AvailabilityChoice] {
    guard startDate < endDate, durationMinutes > 0, durationMinutes <= Int.max / 60, limit > 0 else {
      throw CalendarAssistantError.invalidDateRange
    }
    let interval = TimeInterval(durationMinutes * 60)
    let busy = (events.map { TaskBusyInterval(startDate: $0.startDate, endDate: $0.endDate) }
      + taskBusyIntervals)
      .filter { $0.endDate > startDate && $0.startDate < endDate }
      .sorted { $0.startDate < $1.startDate }

    var cursor = startDate
    var choices: [AvailabilityChoice] = []
    for item in busy {
      if cursor.addingTimeInterval(interval) <= item.startDate {
        choices.append(AvailabilityChoice(startDate: cursor, endDate: cursor.addingTimeInterval(interval)))
        if choices.count == limit { return choices }
      }
      if item.endDate > cursor { cursor = item.endDate }
    }
    if cursor.addingTimeInterval(interval) <= endDate {
      choices.append(AvailabilityChoice(startDate: cursor, endDate: cursor.addingTimeInterval(interval)))
    }
    return choices
  }
}

// Ranks calendar events against the title the user typed ("cancel my dentist
// appointment") without any model: lowercase, fold diacritics, drop command
// words, then score by the share of query words that start a title word.
public enum CalendarEventMatcher {
  private static let ignoredWords: Set<String> = [
    "a", "an", "the", "my", "to", "for", "of", "at", "on", "in", "with",
    "cancel", "delete", "remove", "move", "reschedule", "change", "edit", "update",
  ]
  private static let minimumScore = 0.5

  public static func matches(
    events: [CalendarEventSummary],
    query: String,
    limit: Int = 5
  ) -> [CalendarEventSummary] {
    let queryWords = words(in: query).filter { !ignoredWords.contains($0) }
    guard !queryWords.isEmpty, limit > 0 else { return [] }
    let phrase = queryWords.joined(separator: " ")

    let scored = events.compactMap { event -> (event: CalendarEventSummary, score: Double)? in
      let titleWords = words(in: event.title)
      let title = titleWords.joined(separator: " ")
      if title == phrase { return (event, 2) }
      if title.contains(phrase) { return (event, 1.5) }
      let hits = queryWords.filter { word in titleWords.contains { $0.hasPrefix(word) } }.count
      let score = Double(hits) / Double(queryWords.count)
      return score >= minimumScore ? (event, score) : nil
    }
    return scored
      .sorted { $0.score != $1.score ? $0.score > $1.score : $0.event.startDate < $1.event.startDate }
      .prefix(limit)
      .map(\.event)
  }

  private static func words(in text: String) -> [String] {
    text
      .folding(options: [.diacriticInsensitive, .caseInsensitive], locale: nil)
      .components(separatedBy: CharacterSet.alphanumerics.inverted)
      .filter { $0.count > 1 || $0.allSatisfy(\.isNumber) }
  }
}
