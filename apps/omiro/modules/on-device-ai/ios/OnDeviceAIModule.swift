import EventKit
import ExpoModulesCore
import Foundation

public class OnDeviceAIModule: Module {
  private var calendarChangeObserver: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("OnDeviceAI")

    Events("onCalendarStoreChanged")

    // EventKit syncs externally-hosted calendars (Google/Exchange via CalDAV)
    // into the local store asynchronously, sometimes after our first read has
    // already returned. Forward EKEventStoreChanged so JS can refetch once
    // that background sync lands instead of being stuck on an empty result.
    OnStartObserving {
      self.calendarChangeObserver = NotificationCenter.default.addObserver(
        forName: .EKEventStoreChanged,
        object: nil,
        queue: .main
      ) { [weak self] _ in
        self?.sendEvent("onCalendarStoreChanged", [:])
      }
    }

    OnStopObserving {
      if let observer = self.calendarChangeObserver {
        NotificationCenter.default.removeObserver(observer)
        self.calendarChangeObserver = nil
      }
    }

    AsyncFunction("getCalendarPermissions") { () async -> String in
      permissionStatusString(EKEventStore.authorizationStatus(for: .event))
    }

    AsyncFunction("requestCalendarPermissions") { () async -> String in
      let status = await requestCalendarAuthorization()
      return permissionStatusString(status)
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

    // Free slots across EventKit events and the task busy intervals the caller
    // passes in. Calendar data never leaves the device.
    AsyncFunction("findCalendarOpenings") { (
      startDate: String,
      endDate: String,
      durationMinutes: Int,
      taskBusyIntervals: [TaskBusyIntervalRecord]
    ) async throws -> [AvailabilityChoiceRecord] in
      // Same ten-year bound as the event listing: the range comes from a model.
      let (start, end) = try calendarRange(startDate: startDate, endDate: endDate)
      let intervals = taskBusyIntervals.compactMap { interval -> TaskBusyInterval? in
        guard let start = iso8601Date(interval.startDate), let end = iso8601Date(interval.endDate), start < end else {
          return nil
        }
        return TaskBusyInterval(startDate: start, endDate: end)
      }
      let events = try await MainActor.run {
        try OnDeviceAICalendarCoordinator.shared.events(from: start, to: end, limit: nil)
      }
      let formatter = ISO8601DateFormatter()
      do {
        return try CalendarAvailability.openings(
          events: events,
          taskBusyIntervals: intervals,
          from: start,
          to: end,
          durationMinutes: durationMinutes
        ).map { choice in
          var record = AvailabilityChoiceRecord()
          record.startDate = formatter.string(from: choice.startDate)
          record.endDate = formatter.string(from: choice.endDate)
          return record
        }
      } catch {
        throw OnDeviceAIException(
          code: "INVALID_DATE_RANGE",
          message: "Availability needs a positive duration and an end after the start."
        )
      }
    }

    // Events in the range whose title matches what the user typed, best match
    // first. Matching runs on-device so titles are never sent to a model.
    AsyncFunction("matchCalendarEvents") { (
      query: String,
      startDate: String,
      endDate: String
    ) async throws -> [CalendarEventSummaryRecord] in
      guard let start = iso8601Date(startDate), let end = iso8601Date(endDate), start < end else {
        throw OnDeviceAIException(
          code: "INVALID_DATE_RANGE",
          message: "Match dates must be ISO 8601 timestamps with an end after the start."
        )
      }
      let events = try await MainActor.run {
        try OnDeviceAICalendarCoordinator.shared.events(from: start, to: end, limit: nil)
      }
      let formatter = ISO8601DateFormatter()
      return CalendarEventMatcher.matches(events: events, query: query).map { event in
        var summary = CalendarEventSummaryRecord()
        summary.id = event.id
        summary.title = event.title
        summary.startDate = formatter.string(from: event.startDate)
        summary.endDate = formatter.string(from: event.endDate)
        summary.isAllDay = event.isAllDay
        summary.location = event.location
        summary.calendarTitle = event.calendarTitle
        summary.isEditable = event.isEditable
        return summary
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
  }
}
