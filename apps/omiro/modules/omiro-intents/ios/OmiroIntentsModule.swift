import AppIntents
import ExpoModulesCore

@available(iOS 18.0, *)
public struct AddNoteIntent: AppIntent {
  public static let title: LocalizedStringResource = "Add a Note"
  public static let description = IntentDescription("Opens Omiro to create a new note.")

  public init() {}

  public func perform() async throws -> some IntentResult & OpensIntent {
    guard let url = appURL(for: .addNote) else {
      throw OmiroIntentError.invalidURL
    }

    return .result(opensIntent: OpenURLIntent(url))
  }
}

@available(iOS 18.0, *)
public struct StartChatIntent: AppIntent {
  public static let title: LocalizedStringResource = "Start a Chat"
  public static let description = IntentDescription("Opens Omiro chat.")

  public init() {}

  public func perform() async throws -> some IntentResult & OpensIntent {
    guard let url = appURL(for: .startChat) else {
      throw OmiroIntentError.invalidURL
    }

    return .result(opensIntent: OpenURLIntent(url))
  }
}

@available(iOS 18.0, *)
public struct AskOmiroIntent: AppIntent {
  public static let title: LocalizedStringResource = "Ask Omiro"
  public static let description = IntentDescription("Starts a chat in Omiro with your question.")

  @Parameter(title: "Question", requestValueDialog: "What do you want to ask?")
  public var question: String

  public init() {}

  public func perform() async throws -> some IntentResult & OpensIntent {
    guard let url = appURL(path: "chat", queryName: "seed", queryValue: question) else {
      throw OmiroIntentError.invalidURL
    }

    return .result(opensIntent: OpenURLIntent(url))
  }
}

@available(iOS 18.0, *)
public struct AddTaskIntent: AppIntent {
  public static let title: LocalizedStringResource = "Add a Task"
  public static let description = IntentDescription("Opens Omiro with a new task ready to add.")

  @Parameter(title: "Task", requestValueDialog: "What do you need to do?")
  public var taskTitle: String

  public init() {}

  public func perform() async throws -> some IntentResult & OpensIntent {
    guard let url = appURL(path: "task", queryName: "add", queryValue: taskTitle) else {
      throw OmiroIntentError.invalidURL
    }

    return .result(opensIntent: OpenURLIntent(url))
  }
}

@available(iOS 18.0, *)
public struct OmiroShortcutsProvider: AppShortcutsProvider {
  public static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: AddNoteIntent(),
      phrases: ["Add a note in \(.applicationName)", "New note in \(.applicationName)"],
      shortTitle: "Add Note",
      systemImageName: "square.and.pencil"
    )
    AppShortcut(
      intent: StartChatIntent(),
      phrases: ["Chat in \(.applicationName)", "Open chat in \(.applicationName)"],
      shortTitle: "Start Chat",
      systemImageName: "bubble.left.and.bubble.right"
    )
    AppShortcut(
      intent: AskOmiroIntent(),
      phrases: ["Ask \(.applicationName)", "Ask \(.applicationName) a question"],
      shortTitle: "Ask Omiro",
      systemImageName: "sparkles"
    )
    AppShortcut(
      intent: AddTaskIntent(),
      phrases: ["Add a task in \(.applicationName)", "New task in \(.applicationName)"],
      shortTitle: "Add Task",
      systemImageName: "checkmark.circle"
    )
  }
}

@available(iOS 17.0, *)
public struct OmiroIntentsPackage: AppIntentsPackage {}

public class OmiroIntentsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("OmiroIntents")

    AsyncFunction("donate") { (intentName: String) async -> Bool in
      guard #available(iOS 18.0, *) else {
        return false
      }

      guard let resolvedIntent = OmiroIntentName(rawValue: intentName) else {
        return false
      }

      do {
        switch resolvedIntent {
        case .addNote:
          try await IntentDonationManager.shared.donate(intent: AddNoteIntent())
        case .startChat:
          try await IntentDonationManager.shared.donate(intent: StartChatIntent())
        }
        return true
      } catch {
        return false
      }
    }
  }
}
