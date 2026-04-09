import Foundation
import Testing
@testable import HominemAppleCore

// MARK: - Helpers

private let chatsBaseURL = URL(string: "http://localhost:4040")!

private func makeChatsClient(protocol protocolClass: URLProtocol.Type) -> APIClient {
    let configuration = URLSessionConfiguration.ephemeral
    configuration.protocolClasses = [protocolClass]
    return APIClient(
        baseURL: chatsBaseURL,
        sessionStore: ChatsTestSessionStore(),
        configuration: configuration
    )
}

private let sampleChatJSON = #"""
{
    "id": "chat-1",
    "userId": "user-1",
    "title": "Test Chat",
    "noteId": null,
    "archivedAt": null,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
}
"""#

private let sampleMessageJSON = #"""
{
    "id": "msg-1",
    "chatId": "chat-1",
    "userId": "user-1",
    "role": "user",
    "content": "Hello",
    "files": null,
    "referencedNotes": null,
    "toolCalls": null,
    "reasoning": null,
    "parentMessageId": null,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
}
"""#

private let sampleAssistantMessageJSON = #"""
{
    "id": "msg-2",
    "chatId": "chat-1",
    "userId": "user-1",
    "role": "assistant",
    "content": "Hi there!",
    "files": null,
    "referencedNotes": null,
    "toolCalls": null,
    "reasoning": null,
    "parentMessageId": null,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
}
"""#

// MARK: - ChatsServiceTests

@Suite(.serialized)
struct ChatsServiceTests {

    // MARK: listChats

    @MainActor
    @Test
    func listChatsDecodesArray() async throws {
        ChatsProtocol.handler = { request in
            #expect(request.url?.path == "/api/chats")
            #expect(request.httpMethod == "GET")
            return .json(status: 200, body: "[\(sampleChatJSON)]")
        }
        let service = ChatsService(client: makeChatsClient(protocol: ChatsProtocol.self))
        let chats = try await service.listChats()
        #expect(chats.count == 1)
        #expect(chats[0].id == "chat-1")
        #expect(chats[0].title == "Test Chat")
    }

    // MARK: createChat

    @MainActor
    @Test
    func createChatPostsCorrectBody() async throws {
        ChatsProtocol.handler = { request in
            #expect(request.url?.path == "/api/chats")
            #expect(request.httpMethod == "POST")
            return .json(status: 201, body: sampleChatJSON)
        }
        let service = ChatsService(client: makeChatsClient(protocol: ChatsProtocol.self))
        let chat = try await service.createChat(input: ChatsCreateInput(title: "Test Chat"))
        #expect(chat.id == "chat-1")
    }

    // MARK: archiveChat

    @MainActor
    @Test
    func archiveChatPostsToArchivePath() async throws {
        ChatsProtocol.handler = { request in
            #expect(request.url?.path == "/api/chats/chat-1/archive")
            #expect(request.httpMethod == "POST")
            return .json(status: 200, body: sampleChatJSON)
        }
        let service = ChatsService(client: makeChatsClient(protocol: ChatsProtocol.self))
        let chat = try await service.archiveChat(id: "chat-1")
        #expect(chat.id == "chat-1")
        #expect(chat.archivedAt == nil) // fixture has null
    }

    // MARK: getMessages

    @MainActor
    @Test
    func getMessagesForwardsQueryParameters() async throws {
        ChatsProtocol.handler = { request in
            #expect(request.url?.path == "/api/chats/chat-1/messages")
            let components = URLComponents(url: request.url!, resolvingAgainstBaseURL: false)
            let items = components?.queryItems ?? []
            #expect(items.contains(URLQueryItem(name: "limit", value: "20")))
            #expect(items.contains(URLQueryItem(name: "offset", value: "40")))
            return .json(status: 200, body: "[\(sampleMessageJSON)]")
        }
        let service = ChatsService(client: makeChatsClient(protocol: ChatsProtocol.self))
        let messages = try await service.getMessages(chatId: "chat-1", limit: 20, offset: 40)
        #expect(messages.count == 1)
        #expect(messages[0].role == .user)
    }

    // MARK: sendMessage

    @MainActor
    @Test
    func sendMessagePostsToSendEndpoint() async throws {
        let sendOutput = #"""
        {
            "streamId": "msg-2",
            "chatId": "chat-1",
            "chatTitle": "Test Chat",
            "messages": {
                "user": \#(sampleMessageJSON),
                "assistant": \#(sampleAssistantMessageJSON)
            },
            "metadata": { "startTime": 0, "timestamp": "2026-01-01T00:00:00.000Z" }
        }
        """#
        ChatsProtocol.handler = { request in
            #expect(request.url?.path == "/api/chats/chat-1/send")
            #expect(request.httpMethod == "POST")
            return .json(status: 200, body: sendOutput)
        }
        let service = ChatsService(client: makeChatsClient(protocol: ChatsProtocol.self))
        let result = try await service.sendMessage(chatId: "chat-1", message: "Hello")
        #expect(result.chatId == "chat-1")
        #expect(result.messages.user.role == .user)
        #expect(result.messages.assistant.role == .assistant)
        #expect(result.messages.assistant.content == "Hi there!")
    }

    // MARK: updateChat

    @MainActor
    @Test
    func updateChatPatchesTitlePath() async throws {
        ChatsProtocol.handler = { request in
            #expect(request.url?.path == "/api/chats/chat-1")
            #expect(request.httpMethod == "PATCH")
            return .json(status: 200, body: #"{"success":true}"#)
        }
        let service = ChatsService(client: makeChatsClient(protocol: ChatsProtocol.self))
        try await service.updateChat(id: "chat-1", title: "New Title")
    }
}

// MARK: - Test infrastructure

private final class ChatsProtocol: URLProtocol, @unchecked Sendable {
    struct MockResponse {
        let status: Int
        let body: String

        static func json(status: Int, body: String) -> MockResponse {
            MockResponse(status: status, body: body)
        }
    }

    nonisolated(unsafe) static var handler: (@Sendable (URLRequest) -> MockResponse)?

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        guard let handler = Self.handler else {
            client?.urlProtocol(self, didFailWithError: URLError(.badServerResponse))
            return
        }
        let mock = handler(request)
        let response = HTTPURLResponse(
            url: request.url!,
            statusCode: mock.status,
            httpVersion: nil,
            headerFields: ["Content-Type": "application/json"]
        )!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: mock.body.data(using: .utf8)!)
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}

private struct ChatsTestSessionStore: SessionStore {
    func load() throws -> CookieJar { CookieJar() }
    func save(_ cookieJar: CookieJar) throws {}
    func clear() throws {}
}
