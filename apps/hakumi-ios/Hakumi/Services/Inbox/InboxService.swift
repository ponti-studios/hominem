import Foundation

// MARK: - Models

struct InboxChat: Identifiable, Sendable, Codable {
    let id: String
    let title: String
    let activityAt: Date
}

struct InboxNote: Identifiable, Sendable, Codable {
    let id: String
    let title: String
    let excerpt: String?
    let updatedAt: Date
}

enum InboxItem: Identifiable, Sendable {
    case chat(InboxChat)
    case note(InboxNote)

    var id: String {
        switch self {
        case .chat(let c): "chat-\(c.id)"
        case .note(let n): "note-\(n.id)"
        }
    }

    var updatedAt: Date {
        switch self {
        case .chat(let c): c.activityAt
        case .note(let n): n.updatedAt
        }
    }

    var title: String {
        switch self {
        case .chat(let c): c.title
        case .note(let n): n.title
        }
    }

    /// The `ProtectedRoute` that opens this item in the detail column.
    var protectedRoute: ProtectedRoute {
        switch self {
        case .chat(let c): .chat(id: c.id)
        case .note(let n): .noteDetail(id: n.id)
        }
    }
}

// MARK: - InboxService

@MainActor
enum InboxService {

    // MARK: - Fetch combined inbox

    /// Fetches chats + notes, merges, and returns sorted by updatedAt descending.
    static func fetchItems() async throws -> [InboxItem] {
        let headers = AuthProvider.shared.getAuthHeaders()
        async let chats = fetchChats(headers: headers)
        async let notes = fetchNotes(headers: headers)
        let (chatItems, noteItems) = try await (chats, notes)
        return (chatItems.map(InboxItem.chat) + noteItems.map(InboxItem.note))
            .sorted { $0.updatedAt > $1.updatedAt }
    }

    // MARK: - GET /api/chats?limit=50

    static func fetchChats(headers: [String: String]) async throws -> [InboxChat] {
        var components = URLComponents(url: AuthService.apiURL("/api/chats"), resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "limit", value: "50")]
        var request = URLRequest(url: components.url!)
        request.timeoutInterval = 15
        for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }

        let (data, response) = try await URLSession.shared.data(for: request)
        try URLRequest.validate(response, throwing: InboxError.fetchFailed)

        guard let arr = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
            return []
        }

        return arr.compactMap { dict -> InboxChat? in
            guard
                let id = dict["id"] as? String,
                let title = dict["title"] as? String,
                let activityStr = dict["activityAt"] as? String,
                let activityAt = Date.fromISO8601(activityStr)
            else { return nil }
            return InboxChat(id: id, title: title, activityAt: activityAt)
        }
    }

    // MARK: - GET /api/notes?sortBy=updatedAt&sortOrder=desc&limit=100

    static func fetchNotes(headers: [String: String]) async throws -> [InboxNote] {
        var components = URLComponents(url: AuthService.apiURL("/api/notes"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "sortBy", value: "updatedAt"),
            URLQueryItem(name: "sortOrder", value: "desc"),
            URLQueryItem(name: "limit", value: "100")
        ]
        var request = URLRequest(url: components.url!)
        request.timeoutInterval = 15
        for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }

        let (data, response) = try await URLSession.shared.data(for: request)
        try URLRequest.validate(response, throwing: InboxError.fetchFailed)

        guard
            let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let arr = json["notes"] as? [[String: Any]]
        else { return [] }

        return arr.compactMap { dict -> InboxNote? in
            guard
                let id = dict["id"] as? String,
                let title = dict["title"] as? String,
                let updatedStr = dict["updatedAt"] as? String,
                let updatedAt = Date.fromISO8601(updatedStr)
            else { return nil }
            return InboxNote(id: id, title: title, excerpt: dict["excerpt"] as? String, updatedAt: updatedAt)
        }
    }
}

// MARK: - InboxError

enum InboxError: LocalizedError {
    case fetchFailed

    var errorDescription: String? {
        "Failed to load inbox. Pull down to try again."
    }
}
