import CoreSpotlight
import Foundation
import UIKit

extension Notification.Name {
  static let omiroSystemLink = Notification.Name("OmiroSystemLinkReceived")
}

// App paths (the part after the scheme) that a quick action or a Spotlight
// result opens. JavaScript turns them into routes, the same way it does for
// any other deep link.
enum OmiroSystemPath {
  static let quickActions: [String: String] = [
    "omiro.new-chat": "chat",
    "omiro.new-note": "note/add",
    "omiro.new-task": "task/add",
  ]

  // Spotlight identifiers are "<kind>:<id>", written by `spotlightIdentifier`.
  static func path(forSpotlightIdentifier identifier: String) -> String? {
    guard let separator = identifier.firstIndex(of: ":") else {
      return nil
    }
    let kind = identifier[..<separator]
    let id = identifier[identifier.index(after: separator)...]
    guard !id.isEmpty else {
      return nil
    }
    switch kind {
    case "chat":
      return "chat/\(id)"
    case "note":
      return "notes/\(id)"
    default:
      return nil
    }
  }

  static func spotlightIdentifier(kind: String, id: String) -> String {
    "\(kind):\(id)"
  }
}

// Holds a link that arrived before JavaScript was listening (a cold start from
// a quick action or a Spotlight result) until the app asks for it.
final class OmiroSystemLinkStore: @unchecked Sendable {
  static let shared = OmiroSystemLinkStore()

  private let lock = NSLock()
  private var pending: String?

  func receive(_ path: String) {
    lock.withLock { pending = path }
    NotificationCenter.default.post(name: .omiroSystemLink, object: nil, userInfo: ["path": path])
  }

  func consume() -> String? {
    lock.withLock {
      defer { pending = nil }
      return pending
    }
  }
}
