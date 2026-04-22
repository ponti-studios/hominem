import Foundation

// MARK: - DeepLinkParser
// Handles:
//   hakumi://<path>          (custom URL scheme, all variants)
//   https://hakumi.app/<path> (universal links)
// Only the path component is used for routing — the scheme/host are normalised away.

enum DeepLinkParser {

    static func parse(_ url: URL) -> AppRoute? {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            return nil
        }

        let segments = pathSegments(from: components, url: url)

        return resolve(segments: segments, queryItems: components.queryItems ?? [])
    }

    // MARK: - Private

    private static func pathSegments(from components: URLComponents, url: URL) -> [String] {
        let path = components.path.trimmingCharacters(in: .init(charactersIn: "/"))
        let pathSegments = path.isEmpty ? [] : path.split(separator: "/").map(String.init)

        guard let scheme = components.scheme?.lowercased(), scheme != "http", scheme != "https" else {
            return pathSegments
        }

        var segments: [String] = []
        if let host = components.host, !host.isEmpty {
            segments.append(host)
        } else if let host = url.host, !host.isEmpty {
            segments.append(host)
        }
        segments.append(contentsOf: pathSegments)
        return segments
    }

    private static func resolve(segments: [String], queryItems: [URLQueryItem]) -> AppRoute {
        switch segments.first {
        case nil, "inbox", "":
            return .inbox

        case "notes":
            if segments.count >= 2 {
                return .noteDetail(id: segments[1])
            }
            return .notesList

        case "chat":
            if segments.count >= 2 {
                return .chat(id: segments[1])
            }
            return .inbox

        case "settings":
            if segments.dropFirst().first == "archived-chats" {
                return .archivedChats
            }
            return .settings

        case "auth", "sign-in":
            return .auth

        case "onboarding":
            return .onboarding

        case "error":
            return .error

        default:
            return .notFound
        }
    }
}
