import Foundation

enum OmiroIntentName: String {
  case addNote = "AddNoteIntent"
  case startChat = "StartChatIntent"
}

enum OmiroRoute: String {
  case addNote = "note/add"
  case startChat = "chat"
}

enum OmiroIntentError: Error {
  case invalidURL
}

func appScheme() -> String? {
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

func appURL(for route: OmiroRoute) -> URL? {
  guard let scheme = appScheme() else {
    return nil
  }

  return URL(string: "\(scheme)://\(route.rawValue)")
}

// An app URL carrying one query value (the question to ask, the task to add).
func appURL(path: String, queryName: String, queryValue: String) -> URL? {
  guard let scheme = appScheme() else {
    return nil
  }

  var components = URLComponents()
  components.scheme = scheme
  components.host = path
  components.queryItems = [URLQueryItem(name: queryName, value: queryValue)]
  return components.url
}
