import AppIntents
import Foundation

#if DEBUG
private let appScheme = "hakumi-dev"
#else
private let appScheme = "hakumi"
#endif

// MARK: - Control Center Intents
//
// These definitions MUST live in this target. Extensions are separate Xcode binaries
// and cannot reference types compiled into the main app.

@available(iOS 16.0, *)
public struct AddNoteControlCenterIntent: AppIntent {
  public static let title: LocalizedStringResource = "Add Note"
  public static let description = IntentDescription("Open Hakumi to create a new note.")

  public init() {}

  public func perform() async throws -> some IntentResult & OpensIntent {
    let url = URL(string: "\(appScheme)://note/add")!
    return .result(opensIntent: OpenURLIntent(url))
  }
}

@available(iOS 16.0, *)
public struct StartChatControlCenterIntent: AppIntent {
  public static let title: LocalizedStringResource = "Start Chat"
  public static let description = IntentDescription("Open the Hakumi AI assistant.")

  public init() {}

  public func perform() async throws -> some IntentResult & OpensIntent {
    let url = URL(string: "\(appScheme)://chat")!
    return .result(opensIntent: OpenURLIntent(url))
  }
}
