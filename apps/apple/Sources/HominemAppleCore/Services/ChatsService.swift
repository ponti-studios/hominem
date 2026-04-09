import Foundation

/// Provides access to the /api/chats endpoints.
///
/// All methods require an active session in the shared `APIClient` cookie jar.
@MainActor
public final class ChatsService {
    private let client: APIClient

    public init(client: APIClient) {
        self.client = client
    }

    // MARK: - List

    public func listChats(limit: Int? = nil) async throws -> [Chat] {
        var query: [URLQueryItem] = []
        if let limit {
            query.append(URLQueryItem(name: "limit", value: String(limit)))
        }
        return try await client.get([Chat].self, path: "/api/chats", query: query)
    }

    // MARK: - Get

    public func getChat(id: String) async throws -> ChatWithMessages {
        try await client.get(ChatWithMessages.self, path: "/api/chats/\(id)")
    }

    // MARK: - Create

    public func createChat(input: ChatsCreateInput) async throws -> Chat {
        try await client.post(Chat.self, path: "/api/chats", body: input)
    }

    // MARK: - Update title

    public func updateChat(id: String, title: String) async throws {
        _ = try await client.patch(
            SuccessEnvelope.self,
            path: "/api/chats/\(id)",
            body: ChatsUpdateInput(title: title)
        )
    }

    // MARK: - Archive

    public func archiveChat(id: String) async throws -> Chat {
        try await client.post(Chat.self, path: "/api/chats/\(id)/archive", body: EmptyChatBody())
    }

    // MARK: - Messages

    public func getMessages(
        chatId: String,
        limit: Int? = nil,
        offset: Int? = nil
    ) async throws -> [ChatMessage] {
        var query: [URLQueryItem] = []
        if let limit { query.append(URLQueryItem(name: "limit", value: String(limit))) }
        if let offset { query.append(URLQueryItem(name: "offset", value: String(offset))) }
        return try await client.get(
            [ChatMessage].self,
            path: "/api/chats/\(chatId)/messages",
            query: query
        )
    }

    // MARK: - Send

    /// Send a message and receive the AI reply synchronously.
    /// For streaming responses (SSE), see `ChatThreadView` in Phase 4.
    public func sendMessage(
        chatId: String,
        message: String,
        fileIds: [String]? = nil,
        noteIds: [String]? = nil
    ) async throws -> ChatsSendOutput {
        let input = ChatsSendInput(message: message, fileIds: fileIds, noteIds: noteIds)
        return try await client.post(
            ChatsSendOutput.self,
            path: "/api/chats/\(chatId)/send",
            body: input
        )
    }
}

private struct EmptyChatBody: Encodable {}
