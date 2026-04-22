import Foundation

// MARK: - Models

struct ChatMessage: Identifiable, Sendable, Equatable, Hashable {
    let id: String
    let chatId: String
    let role: String
    let content: String
    let reasoning: String?
    let createdAt: Date
    var isOptimistic: Bool

    init(
        id: String,
        chatId: String,
        role: String,
        content: String,
        reasoning: String? = nil,
        createdAt: Date,
        isOptimistic: Bool = false
    ) {
        self.id = id
        self.chatId = chatId
        self.role = role
        self.content = content
        self.reasoning = reasoning
        self.createdAt = createdAt
        self.isOptimistic = isOptimistic
    }

    static func == (lhs: ChatMessage, rhs: ChatMessage) -> Bool {
        lhs.id == rhs.id && lhs.content == rhs.content && lhs.isOptimistic == rhs.isOptimistic
    }

    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}

struct ChatDetail: Sendable {
    let id: String
    let title: String
}

// MARK: - ChatService

@MainActor
enum ChatService {

    static func fetchMessages(chatId: String) async throws -> [ChatMessage] {
        let url = AuthService.apiURL("/api/chats/\(chatId)/messages?limit=50")
        var request = URLRequest(url: url)
        request.timeoutInterval = 15
        let headers = AuthProvider.shared.getAuthHeaders()
        for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw ChatError.fetchFailed
        }

        guard let arr = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
            return []
        }

        return arr.compactMap(parseMessage)
    }

    static func fetchChatDetail(id: String) async throws -> ChatDetail {
        let url = AuthService.apiURL("/api/chats/\(id)")
        var request = URLRequest(url: url)
        request.timeoutInterval = 15
        let headers = AuthProvider.shared.getAuthHeaders()
        for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw ChatError.fetchFailed
        }

        guard
            let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let chatId = dict["id"] as? String
        else { throw ChatError.fetchFailed }

        let title = dict["title"] as? String ?? "Chat"
        return ChatDetail(id: chatId, title: title)
    }

    /// Sends a message and waits for the full streamed AI response to complete.
    static func sendMessage(chatId: String, text: String, fileIds: [String]? = nil) async throws {
        let url = AuthService.apiURL("/api/chats/\(chatId)/stream")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 120
        let headers = AuthProvider.shared.getAuthHeaders()
        for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }
        var body: [String: Any] = ["message": text]
        if let fileIds, !fileIds.isEmpty { body["fileIds"] = fileIds }
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)

        let (_, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw ChatError.sendFailed
        }
    }

    static func archiveChat(id: String) async throws {
        let url = AuthService.apiURL("/api/chats/\(id)/archive")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = 15
        let headers = AuthProvider.shared.getAuthHeaders()
        for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }

        let (_, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw ChatError.archiveFailed
        }
    }

    static func updateChatTitle(id: String, title: String) async throws {
        let url = AuthService.apiURL("/api/chats/\(id)")
        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 15
        let headers = AuthProvider.shared.getAuthHeaders()
        for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }
        request.httpBody = try? JSONSerialization.data(withJSONObject: ["title": title])

        let (_, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw ChatError.fetchFailed
        }
    }

    /// Creates a note seeded with content extracted from a conversation.
    static func createNoteFromConversation(title: String, content: String) async throws -> String {
        let url = AuthService.apiURL("/api/notes")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 15
        let headers = AuthProvider.shared.getAuthHeaders()
        for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }
        request.httpBody = try? JSONSerialization.data(withJSONObject: ["title": title, "content": content])

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw ChatError.fetchFailed
        }

        guard
            let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let noteId = dict["id"] as? String
        else { throw ChatError.fetchFailed }

        return noteId
    }

    static func createChat(title: String) async throws -> ChatDetail {
        let url = AuthService.apiURL("/api/chats")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 15
        let headers = AuthProvider.shared.getAuthHeaders()
        for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }
        request.httpBody = try? JSONSerialization.data(withJSONObject: ["title": title])

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw ChatError.fetchFailed
        }

        guard
            let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let newId = dict["id"] as? String
        else { throw ChatError.fetchFailed }

        let chatTitle = dict["title"] as? String ?? title
        return ChatDetail(id: newId, title: chatTitle)
    }

    // MARK: - Helpers

    private static func parseMessage(_ dict: [String: Any]) -> ChatMessage? {
        guard
            let id = dict["id"] as? String,
            let role = dict["role"] as? String,
            let content = dict["content"] as? String,
            let createdStr = dict["createdAt"] as? String,
            let createdAt = parseDate(createdStr)
        else { return nil }

        let chatId = dict["chatId"] as? String ?? ""
        let reasoning = dict["reasoning"] as? String
        return ChatMessage(id: id, chatId: chatId, role: role, content: content, reasoning: reasoning, createdAt: createdAt)
    }

    private static func parseDate(_ string: String) -> Date? {
        let withFrac = ISO8601DateFormatter()
        withFrac.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = withFrac.date(from: string) { return d }
        let noFrac = ISO8601DateFormatter()
        noFrac.formatOptions = [.withInternetDateTime]
        return noFrac.date(from: string)
    }
}

// MARK: - ChatError

enum ChatError: LocalizedError {
    case fetchFailed
    case sendFailed
    case archiveFailed

    var errorDescription: String? {
        switch self {
        case .fetchFailed: "Failed to load messages."
        case .sendFailed: "Failed to send message. Please try again."
        case .archiveFailed: "Failed to archive conversation."
        }
    }
}
