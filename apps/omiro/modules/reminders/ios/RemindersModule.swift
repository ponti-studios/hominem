import EventKit
import ExpoModulesCore
import Foundation

public class RemindersModule: Module {
  private var storeChangeObserver: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("Reminders")

    Events("onRemindersStoreChanged")

    // Reminders synced from other devices/iCloud can land after our first
    // read, same as EKEventStoreChanged for calendars.
    OnStartObserving {
      self.storeChangeObserver = NotificationCenter.default.addObserver(
        forName: .EKEventStoreChanged,
        object: nil,
        queue: .main
      ) { [weak self] _ in
        self?.sendEvent("onRemindersStoreChanged", [:])
      }
    }

    OnStopObserving {
      if let observer = self.storeChangeObserver {
        NotificationCenter.default.removeObserver(observer)
        self.storeChangeObserver = nil
      }
    }

    AsyncFunction("getAuthorizationStatus") { () -> String in
      remindersPermissionStatusString(EKEventStore.authorizationStatus(for: .reminder))
    }

    AsyncFunction("requestAccess") { () async -> String in
      let status = await requestRemindersAuthorization()
      return remindersPermissionStatusString(status)
    }

    AsyncFunction("listReminders") { () async throws -> [[String: Any]] in
      try await listReminders()
    }

    AsyncFunction("getReminder") { (id: String) throws -> [String: Any]? in
      try getReminder(id: id)
    }

    AsyncFunction("createReminder") { (input: [String: Any]) throws -> [String: Any] in
      try createReminder(input: input)
    }

    AsyncFunction("updateReminder") { (id: String, patch: [String: Any]) throws -> [String: Any] in
      try updateReminder(id: id, patch: patch)
    }

    AsyncFunction("completeReminder") { (id: String, completed: Bool) throws -> [String: Any] in
      try completeReminder(id: id, completed: completed)
    }

    AsyncFunction("deleteReminder") { (id: String) throws -> Void in
      try deleteReminder(id: id)
    }
  }
}
