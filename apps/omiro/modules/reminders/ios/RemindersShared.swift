import EventKit
import ExpoModulesCore
import Foundation
import os.log

let remindersLog = OSLog(subsystem: "com.hominem.omiro", category: "Reminders")

// Mirrors OnDeviceAIException: a stable `code` string the JS side can branch
// on instead of parsing free-text error messages.
final class RemindersException: Exception, @unchecked Sendable {
  private let messageText: String
  private let codeText: String

  init(code: String, message: String) {
    self.codeText = code
    self.messageText = message
    super.init()
  }

  override var reason: String { messageText }
  override var code: String { codeText }

  static var missingPermission: RemindersException {
    RemindersException(
      code: "MISSING_PERMISSION",
      message: "Reminders access is required to manage tasks."
    )
  }

  static var notFound: RemindersException {
    RemindersException(
      code: "REMINDER_NOT_FOUND",
      message: "This reminder is no longer available."
    )
  }

  static func writeFailed(_ underlying: Error) -> RemindersException {
    RemindersException(
      code: "REMINDER_WRITE_FAILED",
      message: "This task couldn't be saved: \(underlying.localizedDescription)"
    )
  }
}

func remindersPermissionStatusString(_ status: EKAuthorizationStatus) -> String {
  switch status {
  case .fullAccess:
    return "authorized"
  case .denied, .restricted, .writeOnly:
    return "denied"
  case .notDetermined:
    return "notDetermined"
  @unknown default:
    return "denied"
  }
}

func requestRemindersAuthorization() async -> EKAuthorizationStatus {
  let store = EKEventStore()
  do {
    _ = try await store.requestFullAccessToReminders()
  } catch {
    os_log(
      "requestRemindersAuthorization: request failed error=%{public}@",
      log: remindersLog,
      type: .error,
      String(describing: error)
    )
  }
  return EKEventStore.authorizationStatus(for: .reminder)
}

// EKReminder.priority uses the iCal/vCal 0-9 scale: 0 = none, 1-4 = high,
// 5 = medium, 6-9 = low. We only ever write the canonical value for each
// bucket so round-tripping through JS stays lossless.
func priorityString(_ value: Int) -> String {
  switch value {
  case 1...4: return "high"
  case 5: return "medium"
  case 6...9: return "low"
  default: return "none"
  }
}

func priorityValue(_ value: String?) -> Int {
  switch value {
  case "high": return 1
  case "medium": return 5
  case "low": return 9
  default: return 0
  }
}

private func dateComponents(from date: Date) -> DateComponents {
  Calendar.current.dateComponents(
    [.year, .month, .day, .hour, .minute, .second, .timeZone],
    from: date
  )
}

func dateFromComponents(_ components: DateComponents?) -> Date? {
  guard let components else { return nil }
  return Calendar.current.date(from: components)
}

func iso8601String(_ date: Date?) -> String? {
    guard let date else { return nil }
  return ISO8601DateFormatter().string(from: date)
}

func reminderDateComponents(_ isoValue: String?) throws -> DateComponents? {
  guard let isoValue else { return nil }
  guard let date = iso8601Date(isoValue) else {
    throw RemindersException(
      code: "INVALID_DATE_RANGE",
      message: "Task dates must be ISO 8601 timestamps."
    )
  }
  return dateComponents(from: date)
}

func iso8601Date(_ value: String) -> Date? {
  let fractionalFormatter = ISO8601DateFormatter()
  fractionalFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
  if let date = fractionalFormatter.date(from: value) {
    return date
  }
  let formatter = ISO8601DateFormatter()
  formatter.formatOptions = [.withInternetDateTime]
  return formatter.date(from: value)
}

// The only alarm a reminder created by Omiro ever carries is the one used to
// surface `location` the same way Reminders.app shows it -- a title with no
// geofence, since we never collect coordinates.
func locationTitle(_ reminder: EKReminder) -> String? {
  reminder.alarms?.first?.structuredLocation?.title
}

func applyLocation(_ location: String?, to reminder: EKReminder) {
  guard let location, !location.isEmpty else {
    reminder.alarms = nil
    return
  }
  let structuredLocation = EKStructuredLocation(title: location)
  let alarm = EKAlarm()
  alarm.structuredLocation = structuredLocation
  reminder.alarms = [alarm]
}

func reminderRecord(_ reminder: EKReminder) -> [String: Any] {
  [
    "id": reminder.calendarItemIdentifier,
    "title": reminder.title ?? "Untitled task",
    "notes": reminder.notes as Any,
    "status": reminder.isCompleted ? "completed" : "pending",
    "completedAt": iso8601String(reminder.completionDate) as Any,
    "priority": priorityString(reminder.priority),
    "startAt": iso8601String(dateFromComponents(reminder.startDateComponents)) as Any,
    "dueAt": iso8601String(dateFromComponents(reminder.dueDateComponents)) as Any,
    "location": locationTitle(reminder) as Any,
    "listTitle": reminder.calendar?.title as Any,
    "createdAt": iso8601String(reminder.creationDate) as Any,
  ]
}
