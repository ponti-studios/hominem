import EventKit
import ExpoModulesCore
import Foundation
import FoundationModels
import os.log

public class OnDeviceAIModule: Module {
  public func definition() -> ModuleDefinition {
    Name("OnDeviceAI")

    Events("onDeviceAILog", "onTimeAssistantStage")

    AsyncFunction("getAvailability") { () async -> String in
      guard #available(iOS 26.0, *) else { return "unsupported" }
      switch SystemLanguageModel.default.availability {
      case .available:
        return "available"
      case .unavailable:
        return "unavailable"
      @unknown default:
        return "unavailable"
      }
    }

    AsyncFunction("getCalendarPermissions") { () async -> String in
      permissionStatusString(EKEventStore.authorizationStatus(for: .event))
    }

    AsyncFunction("requestCalendarPermissions") { () async -> String in
      let status = await requestCalendarAuthorization()
      return permissionStatusString(status)
    }

    AsyncFunction("getCalendarEvents") { (startDate: String, endDate: String) throws -> [[String: Any]] in
      try fetchCalendarEvents(startDate: startDate, endDate: endDate)
    }

    AsyncFunction("listCalendarEventSummaries") { (startDate: String, endDate: String) async throws -> [CalendarEventSummaryRecord] in
      try await MainActor.run {
        try OnDeviceAICalendarCoordinator.shared.summaries(startDate: startDate, endDate: endDate)
      }
    }

    AsyncFunction("presentCalendarEvent") { (id: String) async throws -> String in
      try await OnDeviceAICalendarCoordinator.shared.presentEvent(id: id)
    }

    AsyncFunction("presentCalendarDraft") { (draft: CalendarDraftRecord) async throws -> String in
      try await OnDeviceAICalendarCoordinator.shared.presentDraft(draft)
    }

    AsyncFunction("interpretTimeRequest") { (prompt: String, _ taskBusyIntervals: [TaskBusyIntervalRecord], requestToken: String) async throws -> TimeAssistantResultRecord in
      guard #available(iOS 26.0, *) else {
        var unavailable = TimeAssistantResultRecord()
        unavailable.error = "Natural-language Time requests require Apple Intelligence on this device. You can still browse and edit Calendar manually."
        return unavailable
      }
      let intervals = taskBusyIntervals.compactMap { interval -> TaskBusyInterval? in
        guard let start = iso8601Date(interval.startDate), let end = iso8601Date(interval.endDate), start < end else {
          return nil
        }
        return TaskBusyInterval(startDate: start, endDate: end)
      }
      sendTimeAssistantStage("understanding", requestToken: requestToken)
      let response = try await runTimeAssistant(
        prompt: prompt,
        taskBusyIntervals: intervals,
        requestToken: requestToken,
        onStage: { stage in
          self.sendTimeAssistantStage(stage, requestToken: requestToken)
        }
      )
      return timeAssistantRecord(from: response)
    }

    AsyncFunction("cancelTimeAssistant") { (requestToken: String) in
      Task {
        await cancelTimeAssistant(requestToken: requestToken)
      }
    }

    AsyncFunction("createCalendarEvent") { (
      title: String,
      startDate: String,
      endDate: String,
      location: String?,
      recurrenceRuleValue: String?
    ) throws -> [String: Any] in
      try createCalendarEvent(
        title: title,
        startDate: startDate,
        endDate: endDate,
        location: location,
        recurrenceRuleValue: recurrenceRuleValue
      )
    }

    AsyncFunction("getCalendarEvent") { (id: String) throws -> [String: Any] in
      try fetchCalendarEvent(id: id)
    }

    AsyncFunction("updateCalendarEvent") { (
      id: String,
      patch: [String: Any],
      recurrenceScope: String
    ) throws -> [String: Any] in
      try updateCalendarEvent(id: id, patch: patch, recurrenceScope: recurrenceScope)
    }

    AsyncFunction("deleteCalendarEvent") { (id: String, recurrenceScope: String) throws -> Void in
      try deleteCalendarEvent(id: id, recurrenceScope: recurrenceScope)
    }

    AsyncFunction("askCalendar") { (prompt: String) async throws -> OnDeviceAIResult in
      os_log("askCalendar AsyncFunction invoked", log: onDeviceAILog, type: .info)
      guard #available(iOS 26.0, *) else {
        throw OnDeviceAIException.modelUnavailable
      }

      let startedAt = Date()
      let response = try await runCalendarQuery(
        prompt: prompt,
        onLog: { event, message, durationMs in
          var payload: [String: Any] = [
            "type": event,
            "message": message,
            "timestamp": Date().timeIntervalSince1970 * 1000,
          ]
          if let durationMs {
            payload["durationMs"] = durationMs
          }
          self.sendEvent("onDeviceAILog", payload)
        }
      )
      os_log(
        "askCalendar AsyncFunction resolved after %{public}.0fms",
        log: onDeviceAILog,
        type: .info,
        Date().timeIntervalSince(startedAt) * 1000
      )
      return OnDeviceAIResult(text: response, isOnDevice: true)
    }
  }

  private func sendTimeAssistantStage(_ stage: String, requestToken: String) {
    sendEvent("onTimeAssistantStage", [
      "stage": stage,
      "requestToken": requestToken,
    ])
  }
}

@available(iOS 26.0, *)
private func timeAssistantRecord(from result: TimeAssistantResult) -> TimeAssistantResultRecord {
  let formatter = ISO8601DateFormatter()
  var record = TimeAssistantResultRecord()
  switch result {
  case .answer(let answer):
    record.kind = "answer"
    record.answer = answer
  case .taskDraft(let draft):
    record.kind = "taskDraft"
    record.taskTitle = draft.title
    record.taskDueAt = draft.dueAt.map(formatter.string)
    record.taskDurationMinutes = draft.durationMinutes
    record.taskScheduledStartAt = draft.scheduledStartAt.map(formatter.string)
    record.taskScheduledEndAt = draft.scheduledEndAt.map(formatter.string)
    record.taskSchedulingWindowStartAt = draft.schedulingWindowStartAt.map(formatter.string)
    record.taskSchedulingWindowEndAt = draft.schedulingWindowEndAt.map(formatter.string)
    record.taskLocation = draft.location
  case .availability(let choices):
    record.kind = "availability"
    record.availability = choices.map { choice in
      var value = AvailabilityChoiceRecord()
      value.startDate = formatter.string(from: choice.startDate)
      value.endDate = formatter.string(from: choice.endDate)
      return value
    }
  case .cancelled:
    record.kind = "cancelled"
  case .error(let message):
    record.error = message
  }
  return record
}
