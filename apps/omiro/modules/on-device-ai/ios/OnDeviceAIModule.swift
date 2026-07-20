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

// Shared "yyyy-MM-dd" formatter for the tool's date-range arguments. Fixed
// POSIX locale and device time zone so parsing never depends on the user's
// region settings, only on the format the model was told to produce.
private func dayFormatter() -> DateFormatter {
  let formatter = DateFormatter()
  formatter.dateFormat = "yyyy-MM-dd"
  formatter.locale = Locale(identifier: "en_US_POSIX")
  formatter.timeZone = .current
  return formatter
}

// Human-readable "today" anchor, e.g. "Monday, 2026-07-20". Given to the
// model so it can resolve relative phrases ("this time last year", "end of
// next month") into concrete dates itself, instead of the tool guessing at
// day-count arithmetic on the model's behalf.
private func todayAnchorString() -> String {
  let formatter = DateFormatter()
  formatter.dateFormat = "EEEE, yyyy-MM-dd"
  formatter.timeZone = .current
  return formatter.string(from: Date())
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

// Coarse time-of-day filter so "what was I doing in the morning" narrows
// results without the model needing to reason about exact hours. Bounds are
// fixed here — in local wall-clock hours via Calendar — rather than left to
// the model, for the same reason day-boundary math is: it's the kind of
// arithmetic that's easy for a model to get subtly wrong and hard to notice.
@available(iOS 26.0, *)
@Generable
private enum DayPart: String, CaseIterable, Sendable {
  case allDay
  case morning
  case afternoon
  case evening
  case night

  /// Local hour-of-day bounds, upper exclusive. `allDay` applies no filter.
  var hourRange: Range<Int>? {
    switch self {
    case .allDay: return nil
    case .morning: return 5..<12
    case .afternoon: return 12..<17
    case .evening: return 17..<21
    case .night: return 21..<24
    }
  }
}

// A single narrow tool: read-only event lookup over an explicit date range,
// optionally narrowed to a part of the day. This is the spike's entire
// surface area — no write access, no other calendars, no attendee/organizer
// data exposed to the model.
//
// The tool itself does no relative-date reasoning ("last year", "next
// month") — it only resolves the exact startDate/endDate the model gives
// it, using Calendar day-boundary math. The model is told today's date and
// is responsible for turning what the user said into concrete dates before
// calling this tool. This split keeps date arithmetic (which broke once
// already, see lookupCalendarEvents history) in Swift/Calendar, while
// letting the model own open-ended natural-language interpretation, which a
// fixed Swift parameter shape could never fully anticipate.
@available(iOS 26.0, *)
private struct CalendarLookupTool: Tool {
  // EventKit's own guidance: predicateForEvents performs poorly over
  // multi-year ranges. A model mistake ("startDate 1900-01-01") shouldn't be
  // able to turn one tool call into a multi-second full-database scan.
  static let maxRangeDays = 3650

  let name = "lookupCalendarEvents"
  let description: String
  // Only String payloads cross this closure so it can stay @Sendable without
  // wrapping tool-call detail in a bespoke Sendable event type.
  let onLog: @Sendable (String, String) -> Void

  init(onLog: @escaping @Sendable (String, String) -> Void) {
    self.onLog = onLog
    self.description =
      "Looks up the user's calendar events within an explicit date range, any time in the "
      + "past or future. Today is \(todayAnchorString()). Resolve whatever the user said — "
      + "\"today\", \"this time last year\", \"end of next month\", \"in the morning\" — into "
      + "concrete startDate/endDate/dayPart values yourself before calling; this tool does not "
      + "interpret relative language."
  }

  @Generable
  struct Arguments {
    @Guide(description: "Start of the search range, formatted \"yyyy-MM-dd\". Inclusive.")
    var startDate: String

    @Guide(
      description:
        "End of the search range, formatted \"yyyy-MM-dd\". Inclusive — events any time on this day are included. May equal startDate for a single day."
    )
    var endDate: String

    @Guide(
      description:
        "Part of the day to restrict results to, only if the user asked for one (e.g. \"in the morning\" -> morning). Defaults to allDay when the user didn't mention a time of day."
    )
    var dayPart: DayPart?
  }

  func call(arguments: Arguments) async throws -> String {
    let dayPart = arguments.dayPart ?? .allDay
    onLog(
      "tool_call",
      "Model called lookupCalendarEvents(startDate: \(arguments.startDate), endDate: \(arguments.endDate), dayPart: \(dayPart.rawValue))"
    )

    let status = EKEventStore.authorizationStatus(for: .event)
    guard status == .fullAccess else {
      onLog("tool_error", "lookupCalendarEvents failed: calendar permission missing")
      throw OnDeviceAIException.missingPermission
    }

    let formatter = dayFormatter()
    guard
      let parsedStart = formatter.date(from: arguments.startDate),
      let parsedEnd = formatter.date(from: arguments.endDate)
    else {
      // A malformed date is a model mistake it can recover from, not an
      // infrastructure failure — return guidance instead of throwing so the
      // model can immediately retry with a corrected call.
      onLog(
        "tool_error",
        "lookupCalendarEvents failed: unparseable date range (\(arguments.startDate) - \(arguments.endDate))"
      )
      return
        "Could not parse that date range. startDate and endDate must both be formatted "
        + "\"yyyy-MM-dd\". Today is \(todayAnchorString()). Retry with corrected dates."
    }

    // Model may hand back the range in either order — normalize rather than
    // erroring, since "endDate before startDate" is a model mistake, not a
    // user-facing one.
    let calendar = Calendar.current
    let start = calendar.startOfDay(for: min(parsedStart, parsedEnd))
    guard
      let requestedEnd = calendar.date(
        byAdding: .day, value: 1, to: calendar.startOfDay(for: max(parsedStart, parsedEnd))),
      let maxEnd = calendar.date(byAdding: .day, value: Self.maxRangeDays, to: start)
    else {
      onLog("tool_result", "lookupCalendarEvents returned 0 event(s)")
      return "No events found."
    }
    let end = min(requestedEnd, maxEnd)

    let store = EKEventStore()
    let predicate = store.predicateForEvents(withStart: start, end: end, calendars: nil)
    var events = store.events(matching: predicate)
      .sorted { $0.startDate < $1.startDate }

    if let hourRange = dayPart.hourRange {
      events = events.filter { event in
        guard !event.isAllDay else { return false }
        let hour = calendar.component(.hour, from: event.startDate)
        return hourRange.contains(hour)
      }
    }

    guard !events.isEmpty else {
      onLog("tool_result", "lookupCalendarEvents returned 0 event(s)")
      return "No events found between \(arguments.startDate) and \(arguments.endDate)."
    }

    let displayFormatter = DateFormatter()
    displayFormatter.dateStyle = .medium
    displayFormatter.timeStyle = .short

    // Capped at 20 — this is a spike, not a general-purpose export; a real
    // tool would need the same resultCap discipline the remote MCP tools
    // declare (see services/api/src/mcp/tools/career.ts).
    let lines = events.prefix(20).map { event -> String in
      let title = event.title ?? "Untitled event"
      let when =
        event.isAllDay
        ? "all day"
        : "\(displayFormatter.string(from: event.startDate)) - \(displayFormatter.string(from: event.endDate))"
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
      "You help the user understand their calendar. Today is \(todayAnchorString()). "
      + "Call lookupCalendarEvents whenever asked about their schedule, meetings, or events — "
      + "never guess. Before calling it, resolve whatever date or range the user implied "
      + "(\"today\", \"this time last year\", \"end of next month\") into an explicit "
      + "startDate/endDate using today's date as your anchor. Be concise."
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
