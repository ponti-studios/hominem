import Foundation
import Testing
@testable import Hakumi

// MARK: - ChatServiceTests

@MainActor
struct ChatServiceTests {

    private let ts = "2024-03-15T10:30:00.000Z"

    private func messageDict(
        id: String = "m1",
        chatId: String = "c1",
        role: String = "user",
        content: String = "Hello"
    ) -> [String: Any] {
        ["id": id, "chatId": chatId, "role": role, "content": content, "createdAt": ts]
    }

    // MARK: - fetchMessages

    @Test func fetchMessagesReturnsParsedArray() async throws {
        let body = MockURLProtocol.json([
            messageDict(id: "m1", role: "user",      content: "Hi"),
            messageDict(id: "m2", role: "assistant",  content: "Hello there")
        ])
        ChatService._testSession = MockURLProtocol.makeSession(body: body)
        defer { ChatService._testSession = nil }

        let messages = try await ChatService.fetchMessages(chatId: "c1")
        #expect(messages.count == 2)
        #expect(messages[0].id == "m1")
        #expect(messages[0].role == "user")
        #expect(messages[1].role == "assistant")
    }

    @Test func fetchMessagesReturnsEmptyOnInvalidJSON() async throws {
        ChatService._testSession = MockURLProtocol.makeSession(body: Data("not json".utf8))
        defer { ChatService._testSession = nil }

        let messages = try await ChatService.fetchMessages(chatId: "c1")
        #expect(messages.isEmpty)
    }

    @Test func fetchMessagesSkipsMalformedEntries() async throws {
        let body = MockURLProtocol.json([
            messageDict(id: "m1"),             // valid
            ["role": "user", "content": "x"]   // missing id — skipped
        ])
        ChatService._testSession = MockURLProtocol.makeSession(body: body)
        defer { ChatService._testSession = nil }

        let messages = try await ChatService.fetchMessages(chatId: "c1")
        #expect(messages.count == 1)
        #expect(messages[0].id == "m1")
    }

    @Test func fetchMessagesThrowsOnServerError() async throws {
        ChatService._testSession = MockURLProtocol.makeSession(statusCode: 403)
        defer { ChatService._testSession = nil }

        do {
            _ = try await ChatService.fetchMessages(chatId: "c1")
            Issue.record("Expected ChatError.fetchFailed")
        } catch let error as ChatError {
            #expect(error == .fetchFailed)
        }
    }

    @Test func fetchMessagesIncludesLimitQueryParam() async throws {
        var capturedURL: URL?
        ChatService._testSession = MockURLProtocol.makeSession { request in
            capturedURL = request.url
            return (200, MockURLProtocol.json([]))
        }
        defer { ChatService._testSession = nil }

        _ = try await ChatService.fetchMessages(chatId: "c1")
        let query = capturedURL?.query ?? ""
        #expect(query.contains("limit=50"))
    }

    // MARK: - fetchChatDetail

    @Test func fetchChatDetailReturnsParsedDetail() async throws {
        let body = MockURLProtocol.json(["id": "c1", "title": "My Chat"])
        ChatService._testSession = MockURLProtocol.makeSession(body: body)
        defer { ChatService._testSession = nil }

        let detail = try await ChatService.fetchChatDetail(id: "c1")
        #expect(detail.id == "c1")
        #expect(detail.title == "My Chat")
    }

    @Test func fetchChatDetailFallsBackToDefaultTitle() async throws {
        let body = MockURLProtocol.json(["id": "c1"])   // no title key
        ChatService._testSession = MockURLProtocol.makeSession(body: body)
        defer { ChatService._testSession = nil }

        let detail = try await ChatService.fetchChatDetail(id: "c1")
        #expect(detail.title == "Chat")
    }

    @Test func fetchChatDetailThrowsOnServerError() async throws {
        ChatService._testSession = MockURLProtocol.makeSession(statusCode: 404)
        defer { ChatService._testSession = nil }

        do {
            _ = try await ChatService.fetchChatDetail(id: "c1")
            Issue.record("Expected ChatError.fetchFailed")
        } catch let error as ChatError {
            #expect(error == .fetchFailed)
        }
    }

    // MARK: - sendMessage

    @Test func sendMessageSucceedsOnOkResponse() async throws {
        ChatService._testSession = MockURLProtocol.makeSession(statusCode: 200)
        defer { ChatService._testSession = nil }

        try await ChatService.sendMessage(chatId: "c1", text: "Hello")
    }

    @Test func sendMessageUsesPostToStreamPath() async throws {
        var capturedRequest: URLRequest?
        ChatService._testSession = MockURLProtocol.makeSession { request in
            capturedRequest = request
            return (200, Data())
        }
        defer { ChatService._testSession = nil }

        try await ChatService.sendMessage(chatId: "c1", text: "Hi")
        #expect(capturedRequest?.httpMethod == "POST")
        #expect(capturedRequest?.url?.path == "/api/chats/c1/stream")
    }

    @Test func sendMessageIncludesFileIdsInBodyWhenProvided() async throws {
        var capturedBody: [String: Any]?
        ChatService._testSession = MockURLProtocol.makeSession { request in
            if let data = MockURLProtocol.bodyData(from: request) {
                capturedBody = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            }
            return (200, Data())
        }
        defer { ChatService._testSession = nil }

        try await ChatService.sendMessage(chatId: "c1", text: "Hi", fileIds: ["f1"])
        #expect((capturedBody?["fileIds"] as? [String]) == ["f1"])
    }

    @Test func sendMessageThrowsOnServerError() async throws {
        ChatService._testSession = MockURLProtocol.makeSession(statusCode: 500)
        defer { ChatService._testSession = nil }

        do {
            try await ChatService.sendMessage(chatId: "c1", text: "Hi")
            Issue.record("Expected ChatError.sendFailed")
        } catch let error as ChatError {
            #expect(error == .sendFailed)
        }
    }

    // MARK: - archiveChat

    @Test func archiveChatSucceedsAndUsesPostToArchivePath() async throws {
        var capturedRequest: URLRequest?
        ChatService._testSession = MockURLProtocol.makeSession { request in
            capturedRequest = request
            return (200, Data())
        }
        defer { ChatService._testSession = nil }

        try await ChatService.archiveChat(id: "c1")
        #expect(capturedRequest?.httpMethod == "POST")
        #expect(capturedRequest?.url?.path == "/api/chats/c1/archive")
    }

    @Test func archiveChatThrowsOnServerError() async throws {
        ChatService._testSession = MockURLProtocol.makeSession(statusCode: 500)
        defer { ChatService._testSession = nil }

        do {
            try await ChatService.archiveChat(id: "c1")
            Issue.record("Expected ChatError.archiveFailed")
        } catch let error as ChatError {
            #expect(error == .archiveFailed)
        }
    }

    // MARK: - deleteChat

    @Test func deleteChatUsesDeleteMethod() async throws {
        var capturedRequest: URLRequest?
        ChatService._testSession = MockURLProtocol.makeSession { request in
            capturedRequest = request
            return (200, Data())
        }
        defer { ChatService._testSession = nil }

        try await ChatService.deleteChat(id: "c1")
        #expect(capturedRequest?.httpMethod == "DELETE")
        #expect(capturedRequest?.url?.path == "/api/chats/c1")
    }

    @Test func deleteChatThrowsOnServerError() async throws {
        ChatService._testSession = MockURLProtocol.makeSession(statusCode: 500)
        defer { ChatService._testSession = nil }

        do {
            try await ChatService.deleteChat(id: "c1")
            Issue.record("Expected ChatError.deleteFailed")
        } catch let error as ChatError {
            #expect(error == .deleteFailed)
        }
    }

    // MARK: - createChat

    @Test func createChatReturnsChatDetail() async throws {
        let body = MockURLProtocol.json(["id": "new-c", "title": "New Chat"])
        ChatService._testSession = MockURLProtocol.makeSession(body: body)
        defer { ChatService._testSession = nil }

        let detail = try await ChatService.createChat(title: "New Chat")
        #expect(detail.id == "new-c")
        #expect(detail.title == "New Chat")
    }

    @Test func createChatFallsBackToProvidedTitleWhenServerOmitsIt() async throws {
        let body = MockURLProtocol.json(["id": "new-c"])  // no title in response
        ChatService._testSession = MockURLProtocol.makeSession(body: body)
        defer { ChatService._testSession = nil }

        let detail = try await ChatService.createChat(title: "Fallback Title")
        #expect(detail.title == "Fallback Title")
    }

    // MARK: - updateChatTitle

    @Test func updateChatTitleSendsPatch() async throws {
        var capturedRequest: URLRequest?
        var capturedBody: [String: Any]?
        ChatService._testSession = MockURLProtocol.makeSession { request in
            capturedRequest = request
            if let data = MockURLProtocol.bodyData(from: request) {
                capturedBody = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            }
            return (200, Data())
        }
        defer { ChatService._testSession = nil }

        try await ChatService.updateChatTitle(id: "c1", title: "New Title")
        #expect(capturedRequest?.httpMethod == "PATCH")
        #expect(capturedBody?["title"] as? String == "New Title")
    }

    // MARK: - Reasoning field

    @Test func fetchMessagesParsesReasoningField() async throws {
        let body = MockURLProtocol.json([
            ["id": "m1", "chatId": "c1", "role": "assistant",
             "content": "Answer", "reasoning": "Because X", "createdAt": ts]
        ])
        ChatService._testSession = MockURLProtocol.makeSession(body: body)
        defer { ChatService._testSession = nil }

        let messages = try await ChatService.fetchMessages(chatId: "c1")
        #expect(messages.first?.reasoning == "Because X")
    }

    @Test func fetchMessagesReasoningIsNilWhenAbsent() async throws {
        let body = MockURLProtocol.json([messageDict()])  // no reasoning key
        ChatService._testSession = MockURLProtocol.makeSession(body: body)
        defer { ChatService._testSession = nil }

        let messages = try await ChatService.fetchMessages(chatId: "c1")
        #expect(messages.first?.reasoning == nil)
    }
}
