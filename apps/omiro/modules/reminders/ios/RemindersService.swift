import EventKit
import Foundation

private let sharedRemindersStore = EKEventStore()

private func requireAuthorized() throws {
  guard EKEventStore.authorizationStatus(for: .reminder) == .fullAccess else {
    throw RemindersException.missingPermission
  }
}

func listReminders() async throws -> [[String: Any]] {
  try requireAuthorized()
  let store = sharedRemindersStore
  let calendars = store.calendars(for: .reminder)
  let predicate = store.predicateForReminders(in: calendars)

  return await withCheckedContinuation { continuation in
    store.fetchReminders(matching: predicate) { reminders in
      let records = (reminders ?? []).map(reminderRecord)
      continuation.resume(returning: records)
    }
  }
}

func getReminder(id: String) throws -> [String: Any]? {
  try requireAuthorized()
  guard let reminder = sharedRemindersStore.calendarItem(withIdentifier: id) as? EKReminder else {
    return nil
  }
  return reminderRecord(reminder)
}

func createReminder(input: [String: Any]) throws -> [String: Any] {
  try requireAuthorized()
  let store = sharedRemindersStore
  guard let calendar = store.defaultCalendarForNewReminders() else {
    throw RemindersException(
      code: "REMINDERS_LIST_UNAVAILABLE",
      message: "No reminders list is available for new tasks."
    )
  }
  guard let title = input["title"] as? String, !title.isEmpty else {
    throw RemindersException(
      code: "REMINDER_WRITE_FAILED",
      message: "A task needs a title."
    )
  }

  let reminder = EKReminder(eventStore: store)
  reminder.calendar = calendar
  reminder.title = title
  reminder.notes = input["notes"] as? String
  reminder.priority = priorityValue(input["priority"] as? String)
  reminder.startDateComponents = try reminderDateComponents(input["startAt"] as? String)
  reminder.dueDateComponents = try reminderDateComponents(input["dueAt"] as? String)
  applyLocation(input["location"] as? String, to: reminder)

  do {
    try store.save(reminder, commit: true)
  } catch {
    throw RemindersException.writeFailed(error)
  }
  return reminderRecord(reminder)
}

func updateReminder(id: String, patch: [String: Any]) throws -> [String: Any] {
  try requireAuthorized()
  guard let reminder = sharedRemindersStore.calendarItem(withIdentifier: id) as? EKReminder else {
    throw RemindersException.notFound
  }

  if let title = patch["title"] as? String {
    reminder.title = title
  }
  if patch.keys.contains("notes") {
    reminder.notes = patch["notes"] as? String
  }
  if let priority = patch["priority"] as? String {
    reminder.priority = priorityValue(priority)
  }
  if patch.keys.contains("startAt") {
    reminder.startDateComponents = try reminderDateComponents(patch["startAt"] as? String)
  }
  if patch.keys.contains("dueAt") {
    reminder.dueDateComponents = try reminderDateComponents(patch["dueAt"] as? String)
  }
  if patch.keys.contains("location") {
    applyLocation(patch["location"] as? String, to: reminder)
  }

  do {
    try sharedRemindersStore.save(reminder, commit: true)
  } catch {
    throw RemindersException.writeFailed(error)
  }
  return reminderRecord(reminder)
}

func completeReminder(id: String, completed: Bool) throws -> [String: Any] {
  try requireAuthorized()
  guard let reminder = sharedRemindersStore.calendarItem(withIdentifier: id) as? EKReminder else {
    throw RemindersException.notFound
  }
  reminder.isCompleted = completed
  do {
    try sharedRemindersStore.save(reminder, commit: true)
  } catch {
    throw RemindersException.writeFailed(error)
  }
  return reminderRecord(reminder)
}

func deleteReminder(id: String) throws {
  try requireAuthorized()
  guard let reminder = sharedRemindersStore.calendarItem(withIdentifier: id) as? EKReminder else {
    throw RemindersException.notFound
  }
  do {
    try sharedRemindersStore.remove(reminder, commit: true)
  } catch {
    throw RemindersException.writeFailed(error)
  }
}
