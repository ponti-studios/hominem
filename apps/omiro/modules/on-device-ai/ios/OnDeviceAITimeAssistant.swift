import Foundation
import FoundationModels

@available(iOS 26.0, *)
private actor TimeAssistantCancellationStore {
  private var cancelledTokens = Set<String>()

  func cancel(_ requestToken: String) {
    cancelledTokens.insert(requestToken)
  }

  func isCancelled(_ requestToken: String) -> Bool {
    cancelledTokens.contains(requestToken)
  }
}

@available(iOS 26.0, *)
private let timeAssistantCancellationStore = TimeAssistantCancellationStore()

@available(iOS 26.0, *)
func cancelTimeAssistant(requestToken: String) async {
  await timeAssistantCancellationStore.cancel(requestToken)
}

@available(iOS 26.0, *)
private func isTimeAssistantCancelled(_ requestToken: String) async -> Bool {
  await timeAssistantCancellationStore.isCancelled(requestToken)
}

@available(iOS 26.0, *)
private actor TimeAssistantState {
  private var outcome: TimeAssistantResult?

  func record(_ result: TimeAssistantResult) {
    outcome = result
  }

  func result() -> TimeAssistantResult? {
    outcome
  }
}

@available(iOS 26.0, *)
private struct FindCalendarEventsTool: Tool {
  let name = "findCalendarEvents"
  let description = "Find calendar events in a bounded ISO 8601 time range. Use this before answering questions about calendar events or before editing an existing event."
  let requestToken: String
  let onStage: @Sendable (String) -> Void

  @Generable
  struct Arguments {
    @Guide(description: "Inclusive range start as an ISO 8601 timestamp.")
    var startDate: String
    @Guide(description: "Exclusive range end as an ISO 8601 timestamp.")
    var endDate: String
  }

  func call(arguments: Arguments) async throws -> String {
    guard await !isTimeAssistantCancelled(requestToken) else { return "Request cancelled." }
    onStage("checkingSchedule")
    guard let start = iso8601Date(arguments.startDate), let end = iso8601Date(arguments.endDate), start < end else {
      return "Invalid date range. Use ISO 8601 timestamps with an end after the start."
    }
    guard end.timeIntervalSince(start) <= 3650 * 24 * 60 * 60 else {
      return "The date range must be no longer than ten years."
    }
    let events = try await MainActor.run {
      try OnDeviceAICalendarCoordinator.shared.events(from: start, to: end)
    }
    guard !events.isEmpty else { return "No calendar events found." }
    let formatter = ISO8601DateFormatter()
    return events.map { event in
      "id: \(event.id) | title: \(event.title) | start: \(formatter.string(from: event.startDate)) | end: \(formatter.string(from: event.endDate))"
    }.joined(separator: "\n")
  }
}

@available(iOS 26.0, *)
private struct EditCalendarEventTool: Tool {
  let name = "editCalendarEvent"
  let description = "Open Apple's calendar editor to create, edit, or delete an event. Call this only after the user clearly asked for a calendar change. The editor is authoritative for calendar choice, attendees, alarms, recurrence, save, delete, and cancellation."
  let state: TimeAssistantState
  let requestToken: String

  @Generable
  struct Arguments {
    @Guide(description: "One of create, update, or delete.")
    var action: String
    @Guide(description: "Existing calendar event id for update or delete.")
    var eventId: String?
    @Guide(description: "New event title for create.")
    var title: String?
    @Guide(description: "New event start as an ISO 8601 timestamp for create.")
    var startDate: String?
    @Guide(description: "New event end as an ISO 8601 timestamp for create.")
    var endDate: String?
    var location: String?
    var notes: String?
  }

  func call(arguments: Arguments) async throws -> String {
    guard await !isTimeAssistantCancelled(requestToken) else { return "Request cancelled." }
    let result: String
    switch arguments.action.lowercased() {
    case "create":
      guard let title = arguments.title, let startText = arguments.startDate, let endText = arguments.endDate,
            let start = iso8601Date(startText), let end = iso8601Date(endText), start < end
      else {
        return "Creating an event requires title, startDate, and endDate as valid ISO 8601 timestamps."
      }
      result = try await OnDeviceAICalendarCoordinator.shared.presentDraft(
        CalendarDraft(title: title, startDate: start, endDate: end, location: arguments.location, notes: arguments.notes)
      )
    case "update", "delete":
      guard let eventId = arguments.eventId, !eventId.isEmpty else {
        return "Updating or deleting requires an eventId from findCalendarEvents."
      }
      result = try await OnDeviceAICalendarCoordinator.shared.presentEvent(id: eventId)
    default:
      return "action must be create, update, or delete."
    }
    if result == "cancelled" {
      await state.record(.cancelled)
    }
    return "Apple's calendar editor returned \(result)."
  }
}

@available(iOS 26.0, *)
private struct FindAvailabilityTool: Tool {
  let name = "findAvailability"
  let description = "Find open time using calendar events and the user's database-backed task busy intervals. Use it for requests to find time or schedule work, never for a calendar write."
  let taskBusyIntervals: [TaskBusyInterval]
  let state: TimeAssistantState
  let requestToken: String
  let onStage: @Sendable (String) -> Void

  @Generable
  struct Arguments {
    @Guide(description: "Range start as an ISO 8601 timestamp.")
    var startDate: String
    @Guide(description: "Range end as an ISO 8601 timestamp.")
    var endDate: String
    @Guide(description: "Required opening duration in minutes.")
    var durationMinutes: Int
  }

  func call(arguments: Arguments) async throws -> String {
    guard await !isTimeAssistantCancelled(requestToken) else { return "Request cancelled." }
    onStage("checkingSchedule")
    guard let start = iso8601Date(arguments.startDate), let end = iso8601Date(arguments.endDate), start < end else {
      return "Invalid date range. Use ISO 8601 timestamps."
    }
    guard end.timeIntervalSince(start) <= 3650 * 24 * 60 * 60 else {
      return "The date range must be no longer than ten years."
    }
    let events = try await MainActor.run {
      try OnDeviceAICalendarCoordinator.shared.events(from: start, to: end, limit: nil)
    }
    let choices = try CalendarAvailability.openings(
      events: events,
      taskBusyIntervals: taskBusyIntervals,
      from: start,
      to: end,
      durationMinutes: arguments.durationMinutes
    )
    await state.record(.availability(choices))
    let formatter = ISO8601DateFormatter()
    return choices.isEmpty
      ? "No openings found."
      : choices.map { "start: \(formatter.string(from: $0.startDate)) | end: \(formatter.string(from: $0.endDate))" }.joined(separator: "\n")
  }
}

@available(iOS 26.0, *)
private struct ProposeTaskTool: Tool {
  let name = "proposeTask"
  let description = "Propose a database-backed task. Use this for a task request, never to create a calendar event."
  let state: TimeAssistantState
  let requestToken: String

  @Generable
  struct Arguments {
    var title: String
    var dueAt: String?
    var durationMinutes: Int?
    var scheduledStartAt: String?
    var scheduledEndAt: String?
    var schedulingWindowStartAt: String?
    var schedulingWindowEndAt: String?
    var location: String?
  }

  func call(arguments: Arguments) async throws -> String {
    guard await !isTimeAssistantCancelled(requestToken) else { return "Request cancelled." }
    let draft = TaskDraft(
      title: arguments.title,
      dueAt: arguments.dueAt.flatMap(iso8601Date),
      durationMinutes: arguments.durationMinutes,
      scheduledStartAt: arguments.scheduledStartAt.flatMap(iso8601Date),
      scheduledEndAt: arguments.scheduledEndAt.flatMap(iso8601Date),
      schedulingWindowStartAt: arguments.schedulingWindowStartAt.flatMap(iso8601Date),
      schedulingWindowEndAt: arguments.schedulingWindowEndAt.flatMap(iso8601Date),
      location: arguments.location
    )
    await state.record(.taskDraft(draft))
    return "Task draft prepared for confirmation."
  }
}

@available(iOS 26.0, *)
func runTimeAssistant(
  prompt: String,
  taskBusyIntervals: [TaskBusyInterval],
  requestToken: String,
  onStage: @escaping @Sendable (String) -> Void
) async throws -> TimeAssistantResult {
  guard case .available = SystemLanguageModel.default.availability else {
    return .error("Natural-language Time requests require Apple Intelligence on this device. You can still browse and edit Calendar manually.")
  }
  let state = TimeAssistantState()
  let today = todayAnchorString()
  let session = LanguageModelSession(
    tools: [
      FindCalendarEventsTool(requestToken: requestToken, onStage: onStage),
      EditCalendarEventTool(state: state, requestToken: requestToken),
      FindAvailabilityTool(taskBusyIntervals: taskBusyIntervals, state: state, requestToken: requestToken, onStage: onStage),
      ProposeTaskTool(state: state, requestToken: requestToken),
    ],
    instructions: """
      You are Omiro's on-device Time assistant. Today is \(today). Calendar data stays on this device.
      Search with findCalendarEvents before answering calendar questions or updating/deleting an event. Use editCalendarEvent for calendar writes; it opens Apple's editor and you must wait for its result. Use findAvailability for open-time requests. Use proposeTask for database-backed task requests. Do not create tasks or calendar events yourself. Be concise after any tool call.
      """
  )
  let response = try await session.respond(to: prompt)
  if await isTimeAssistantCancelled(requestToken) {
    return .cancelled
  }
  onStage("preparingSuggestion")
  return await state.result() ?? .answer(response.content)
}
