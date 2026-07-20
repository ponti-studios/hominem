import EventKit
import ExpoModulesCore
import Foundation
import FoundationModels
import os.log

private let onDeviceAILog = OSLog(subsystem: "com.hominem.omiro", category: "OnDeviceAI")

// Mirrors the VoiceTranscriberException pattern: a stable `code` string the
// JS side can branch on instead of parsing free-text error messages.
private final class OnDeviceAIException: Exception, @unchecked Sendable {
  private let messageText: String
  private let codeText: String

  init(code: String, message: String) {
    self.codeText = code
    self.messageText = message
    super.init()
  }

  override var reason: String { messageText }
  override var code: String { codeText }

  static var modelUnavailable: OnDeviceAIException {
    OnDeviceAIException(
      code: "MODEL_UNAVAILABLE",
      message: "Apple Intelligence is not available on this device."
    )
  }

  static var missingPermission: OnDeviceAIException {
    OnDeviceAIException(
      code: "MISSING_PERMISSION",
      message: "Calendar access is required to answer this question."
    )
  }

  static var generationFailed: OnDeviceAIException {
    OnDeviceAIException(
      code: "GENERATION_FAILED",
      message: "The on-device model failed to respond."
    )
  }
}

private struct OnDeviceAIResult: Record {
  @Field
  var text: String = ""

  @Field
  var isOnDevice: Bool = true
}

private func permissionStatusString(_ status: EKAuthorizationStatus) -> String {
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

private func requestCalendarAuthorization() async -> EKAuthorizationStatus {
  let store = EKEventStore()
  do {
    _ = try await store.requestFullAccessToEvents()
  } catch {
    os_log(
      "requestCalendarAuthorization: request failed error=%{public}@",
      log: onDeviceAILog,
      type: .error,
      String(describing: error)
    )
  }
  return EKEventStore.authorizationStatus(for: .event)
}

// A single narrow tool: read-only event lookup over a bounded forward
// window. This is the spike's entire surface area — no write access, no
// other calendars, no attendee/organizer data exposed to the model.
@available(iOS 26.0, *)
private struct CalendarLookupTool: Tool {
  let name = "lookupCalendarEvents"
  let description =
    "Looks up the user's calendar events starting today. Use this whenever the user asks about their schedule, meetings, or upcoming events."
  // Only String payloads cross this closure so it can stay @Sendable without
  // wrapping tool-call detail in a bespoke Sendable event type.
  let onLog: @Sendable (String, String) -> Void

  @Generable
  struct Arguments {
    @Guide(
      description:
        "Number of days from today to search forward, e.g. 1 for \"today\", 7 for \"this week\". Defaults to 1."
    )
    var daysAhead: Int?
  }

  func call(arguments: Arguments) async throws -> String {
    let days = max(1, min(arguments.daysAhead ?? 1, 30))
    onLog("tool_call", "Model called lookupCalendarEvents(daysAhead: \(days))")

    let status = EKEventStore.authorizationStatus(for: .event)
    guard status == .fullAccess else {
      onLog("tool_error", "lookupCalendarEvents failed: calendar permission missing")
      throw OnDeviceAIException.missingPermission
    }

    let store = EKEventStore()
    let start = Calendar.current.startOfDay(for: Date())
    guard let end = Calendar.current.date(byAdding: .day, value: days, to: start) else {
      onLog("tool_result", "lookupCalendarEvents returned 0 event(s)")
      return "No events found."
    }

    let predicate = store.predicateForEvents(withStart: start, end: end, calendars: nil)
    let events = store.events(matching: predicate)
      .sorted { $0.startDate < $1.startDate }

    guard !events.isEmpty else {
      onLog("tool_result", "lookupCalendarEvents returned 0 event(s)")
      return "No events found in the next \(days) day(s)."
    }

    let formatter = DateFormatter()
    formatter.dateStyle = .medium
    formatter.timeStyle = .short

    // Capped at 20 — this is a spike, not a general-purpose export; a real
    // tool would need the same resultCap discipline the remote MCP tools
    // declare (see services/api/src/mcp/tools/career.ts).
    let lines = events.prefix(20).map { event -> String in
      let title = event.title ?? "Untitled event"
      let when =
        event.isAllDay
        ? "all day"
        : "\(formatter.string(from: event.startDate)) - \(formatter.string(from: event.endDate))"
      return "- \(title): \(when)"
    }

    onLog("tool_result", "lookupCalendarEvents returned \(events.count) event(s)")
    return lines.joined(separator: "\n")
  }
}

@available(iOS 26.0, *)
private func runCalendarQuery(
  prompt: String,
  onLog: @escaping @Sendable (String, String) -> Void
) async throws -> String {
  guard case .available = SystemLanguageModel.default.availability else {
    throw OnDeviceAIException.modelUnavailable
  }

  onLog("session_start", "Starting on-device model session")
  let session = LanguageModelSession(
    tools: [CalendarLookupTool(onLog: onLog)],
    instructions:
      "You help the user understand their calendar. Call lookupCalendarEvents whenever asked about their schedule, meetings, or events — never guess. Be concise."
  )

  onLog("prompt_sent", "Sending prompt to model: \"\(prompt)\"")
  do {
    let response = try await session.respond(to: prompt)
    onLog("response_received", "Model responded (\(response.content.count) chars)")
    return response.content
  } catch {
    os_log(
      "runCalendarQuery: generation failed error=%{public}@",
      log: onDeviceAILog,
      type: .error,
      String(describing: error)
    )
    onLog("generation_error", "Model generation failed: \(String(describing: error))")
    throw OnDeviceAIException.generationFailed
  }
}

public class OnDeviceAIModule: Module {
  public func definition() -> ModuleDefinition {
    Name("OnDeviceAI")

    Events("onDeviceAILog")

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

    AsyncFunction("askCalendar") { (prompt: String) async throws -> OnDeviceAIResult in
      os_log("askCalendar AsyncFunction invoked", log: onDeviceAILog, type: .info)
      guard #available(iOS 26.0, *) else {
        throw OnDeviceAIException.modelUnavailable
      }

      let emitLog: @Sendable (String, String) -> Void = { [weak self] type, message in
        self?.sendEvent(
          "onDeviceAILog",
          ["type": type, "message": message, "timestamp": Date().timeIntervalSince1970 * 1000]
        )
      }

      do {
        let text = try await runCalendarQuery(prompt: prompt, onLog: emitLog)
        os_log("askCalendar AsyncFunction resolving successfully", log: onDeviceAILog, type: .info)
        return OnDeviceAIResult(text: text, isOnDevice: true)
      } catch {
        os_log(
          "askCalendar AsyncFunction rejecting: %{public}@",
          log: onDeviceAILog,
          type: .error,
          String(describing: error)
        )
        throw error
      }
    }
  }
}
