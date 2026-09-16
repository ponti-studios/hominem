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

  public init(
    title: String,
    startDate: Date,
    endDate: Date,
    isAllDay: Bool = false,
    location: String? = nil,
    notes: String? = nil
  ) {
    self.title = title
    self.startDate = startDate
    self.endDate = endDate
    self.isAllDay = isAllDay
    self.location = location
    self.notes = notes
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

public struct TaskDraft: Codable, Equatable, Sendable {
  public let title: String
  public let dueAt: Date?
  public let durationMinutes: Int?
  public let scheduledStartAt: Date?
  public let scheduledEndAt: Date?
  public let schedulingWindowStartAt: Date?
  public let schedulingWindowEndAt: Date?
  public let location: String?

  public init(
    title: String,
    dueAt: Date? = nil,
    durationMinutes: Int? = nil,
    scheduledStartAt: Date? = nil,
    scheduledEndAt: Date? = nil,
    schedulingWindowStartAt: Date? = nil,
    schedulingWindowEndAt: Date? = nil,
    location: String? = nil
  ) {
    self.title = title
    self.dueAt = dueAt
    self.durationMinutes = durationMinutes
    self.scheduledStartAt = scheduledStartAt
    self.scheduledEndAt = scheduledEndAt
    self.schedulingWindowStartAt = schedulingWindowStartAt
    self.schedulingWindowEndAt = schedulingWindowEndAt
    self.location = location
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

public enum TimeAssistantResult: Codable, Equatable, Sendable {
  case answer(String)
  case taskDraft(TaskDraft)
  case availability([AvailabilityChoice])
  case cancelled
  case error(String)
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
