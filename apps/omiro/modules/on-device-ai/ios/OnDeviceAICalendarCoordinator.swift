import EventKit
import EventKitUI
import Foundation
import UIKit

@MainActor
final class OnDeviceAICalendarCoordinator: NSObject, @preconcurrency EKEventEditViewDelegate {
  static let shared = OnDeviceAICalendarCoordinator()

  private let store = EKEventStore()
  private var editorContinuation: CheckedContinuation<String, Never>?

  func summaries(startDate: String, endDate: String) throws -> [CalendarEventSummaryRecord] {
    guard EKEventStore.authorizationStatus(for: .event) == .fullAccess else {
      throw OnDeviceAIException.missingPermission
    }
    let range = try calendarRange(startDate: startDate, endDate: endDate)
    let predicate = store.predicateForEvents(withStart: range.start, end: range.end, calendars: nil)
    let formatter = ISO8601DateFormatter()
    return store.events(matching: predicate)
      .sorted { $0.startDate < $1.startDate }
      .prefix(100)
      .map { event in
        var summary = CalendarEventSummaryRecord()
        summary.id = event.eventIdentifier ?? ""
        summary.title = event.title ?? "Untitled event"
        summary.startDate = formatter.string(from: event.startDate)
        summary.endDate = formatter.string(from: event.endDate)
        summary.isAllDay = event.isAllDay
        summary.location = event.location
        summary.calendarTitle = event.calendar?.title
        summary.isEditable = event.calendar?.allowsContentModifications ?? false
        return summary
      }
  }

  func events(from startDate: Date, to endDate: Date, limit: Int? = 20) throws -> [CalendarEventSummary] {
    guard EKEventStore.authorizationStatus(for: .event) == .fullAccess else {
      throw OnDeviceAIException.missingPermission
    }
    let predicate = store.predicateForEvents(withStart: startDate, end: endDate, calendars: nil)
    let events = store.events(matching: predicate).sorted { $0.startDate < $1.startDate }
    let boundedEvents = limit.map { Array(events.prefix($0)) } ?? events
    return boundedEvents
      .map { event in
        CalendarEventSummary(
          id: event.eventIdentifier ?? "",
          title: event.title ?? "Untitled event",
          startDate: event.startDate,
          endDate: event.endDate,
          isAllDay: event.isAllDay,
          location: event.location,
          calendarTitle: event.calendar?.title,
          isEditable: event.calendar?.allowsContentModifications ?? false
        )
      }
  }

  func presentEvent(id: String) async throws -> String {
    guard EKEventStore.authorizationStatus(for: .event) == .fullAccess else {
      throw OnDeviceAIException.missingPermission
    }
    guard let event = store.event(withIdentifier: id) else {
      throw OnDeviceAIException(code: "EVENT_NOT_FOUND", message: "This calendar event is no longer available.")
    }
    return await present(event: event)
  }

  func presentDraft(_ draft: CalendarDraftRecord) async throws -> String {
    guard let start = iso8601Date(draft.startDate), let end = iso8601Date(draft.endDate) else {
      throw OnDeviceAIException(code: "INVALID_DATE_RANGE", message: "Calendar event dates must be ISO 8601 timestamps.")
    }
    return try await presentDraft(
      CalendarDraft(
        title: draft.title,
        startDate: start,
        endDate: end,
        isAllDay: draft.isAllDay,
        location: draft.location,
        notes: draft.notes
      )
    )
  }

  func presentDraft(_ draft: CalendarDraft) async throws -> String {
    guard EKEventStore.authorizationStatus(for: .event) == .fullAccess else {
      throw OnDeviceAIException.missingPermission
    }
    guard draft.startDate < draft.endDate else {
      throw OnDeviceAIException(code: "INVALID_DATE_RANGE", message: "Calendar event dates must be ISO 8601 timestamps.")
    }
    let event = EKEvent(eventStore: store)
    event.title = draft.title
    event.startDate = draft.startDate
    event.endDate = draft.endDate
    event.isAllDay = draft.isAllDay
    event.location = draft.location
    event.notes = draft.notes
    event.calendar = store.defaultCalendarForNewEvents
    return await present(event: event)
  }

  private func present(event: EKEvent) async -> String {
    guard editorContinuation == nil else { return "cancelled" }
    guard let controller = foregroundViewController() else { return "cancelled" }
    let editor = EKEventEditViewController()
    editor.eventStore = store
    editor.event = event
    editor.editViewDelegate = self
    return await withCheckedContinuation { continuation in
      editorContinuation = continuation
      controller.present(editor, animated: true)
    }
  }

  func eventEditViewController(
    _ controller: EKEventEditViewController,
    didCompleteWith action: EKEventEditViewAction
  ) {
    let result: String
    switch action {
    case .saved: result = "saved"
    case .deleted: result = "deleted"
    case .canceled: result = "cancelled"
    @unknown default: result = "cancelled"
    }
    controller.dismiss(animated: true)
    editorContinuation?.resume(returning: result)
    editorContinuation = nil
  }

  private func foregroundViewController() -> UIViewController? {
    let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
    let root = scenes.first(where: { $0.activationState == .foregroundActive })?.windows.first(where: \.isKeyWindow)?.rootViewController
    var controller = root
    while let presented = controller?.presentedViewController { controller = presented }
    return controller
  }
}
