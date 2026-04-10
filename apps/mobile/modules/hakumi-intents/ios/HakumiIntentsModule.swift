import AppIntents
import ExpoModulesCore
import Foundation

private enum HakumiIntentName: String {
  case addNote = "AddNoteIntent"
  case startChat = "StartChatIntent"
}

private enum HakumiRoute: String {
  case addNote = "note/add"
  case startChat = "chat"
}

private enum HakumiIntentError: Error {
  case invalidURL
}

private func appScheme() -> String? {
  guard
    let urlTypes = Bundle.main.object(forInfoDictionaryKey: "CFBundleURLTypes") as? [[String: Any]]
  else {
    return nil
  }

  for urlType in urlTypes {
    if let schemes = urlType["CFBundleURLSchemes"] as? [String], let scheme = schemes.first, !scheme.isEmpty {
      return scheme
    }
  }

  return nil
}

private func appURL(for route: HakumiRoute) -> URL? {
  guard let scheme = appScheme() else {
    return nil
  }

  return URL(string: "\(scheme)://\(route.rawValue)")
}

@available(iOS 18.0, *)
public struct AddNoteIntent: AppIntent {
  public static let title: LocalizedStringResource = "Add a Note"
  public static let description = IntentDescription("Opens Hakumi to create a new note.")

  public init() {}

  public func perform() async throws -> some IntentResult & OpensIntent {
    guard let url = appURL(for: .addNote) else {
      throw HakumiIntentError.invalidURL
    }

    return .result(opensIntent: OpenURLIntent(url))
  }
}

@available(iOS 18.0, *)
public struct StartChatIntent: AppIntent {
  public static let title: LocalizedStringResource = "Start a Chat"
  public static let description = IntentDescription("Opens Hakumi chat.")

  public init() {}

  public func perform() async throws -> some IntentResult & OpensIntent {
    guard let url = appURL(for: .startChat) else {
      throw HakumiIntentError.invalidURL
    }

    return .result(opensIntent: OpenURLIntent(url))
  }
}

@available(iOS 18.0, *)
public struct HakumiShortcutsProvider: AppShortcutsProvider {
  public static var appShortcuts: [AppShortcut] {
    [
      AppShortcut(
        intent: AddNoteIntent(),
        phrases: ["Add a note in \(.applicationName)", "New note in \(.applicationName)"],
        shortTitle: "Add Note",
        systemImageName: "square.and.pencil"
      ),
      AppShortcut(
        intent: StartChatIntent(),
        phrases: ["Chat in \(.applicationName)", "Open chat in \(.applicationName)"],
        shortTitle: "Start Chat",
        systemImageName: "bubble.left.and.bubble.right"
      ),
    ]
  }
}

@available(iOS 17.0, *)
public struct HakumiIntentsPackage: AppIntentsPackage {}

public class HakumiIntentsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("HakumiIntents")

    AsyncFunction("donate") { (intentName: String) async -> Bool in
      guard #available(iOS 18.0, *) else {
        return false
      }

      guard let resolvedIntent = HakumiIntentName(rawValue: intentName) else {
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
