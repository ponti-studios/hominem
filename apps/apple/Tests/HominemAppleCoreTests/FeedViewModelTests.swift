import Foundation
import Testing
@testable import HominemAppleCore

// MARK: - Fixtures

private let feedBaseURL = URL(string: "http://localhost:4040")!

private func noteJSON(id: String, updatedAt: String) -> String {
    #"""
    {
        "id": "\#(id)",
        "userId": "user-1",
        "type": "note",
        "status": "draft",
        "title": "Note \#(id)",
        "content": "Content",
        "excerpt": null,
        "tags": [],
        "mentions": null,
        "analysis": null,
        "parentNoteId": null,
        "files": [],
        "versionNumber": 1,
        "isLatestVersion": true,
        "publishedAt": null,
        "scheduledFor": null,
        "createdAt": "\#(updatedAt)",
        "updatedAt": "\#(updatedAt)"
    }
    """#
}

private func noteListJSON(_ notes: [String]) -> String {
    "{\"notes\":[\(notes.joined(separator: ","))]}"
}

private func chatListJSON(_ chats: [String]) -> String {
    "[\(chats.joined(separator: ","))]"
}

private func chatJSON(id: String, updatedAt: String) -> String {
    #"""
    {
        "id": "\#(id)",
        "userId": "user-1",
        "title": "Chat \#(id)",
        "noteId": null,
        "archivedAt": null,
        "createdAt": "\#(updatedAt)",
        "updatedAt": "\#(updatedAt)"
    }
    """#
}

// MARK: - Mock URLProtocol

private final class FeedMockProtocol: URLProtocol, @unchecked Sendable {
    struct MockResponse {
        let status: Int
        let body: String
        static func json(status: Int = 200, body: String) -> MockResponse {
            MockResponse(status: status, body: body)
        }
    }

    nonisolated(unsafe) static var notesResponse: MockResponse?
    nonisolated(unsafe) static var chatsResponse: MockResponse?
    nonisolated(unsafe) static var shouldFail = false

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        if Self.shouldFail {
            client?.urlProtocol(self, didFailWithError: URLError(.notConnectedToInternet))
            return
        }
        let path = request.url?.path ?? ""
        let response: MockResponse
        if path.hasPrefix("/api/notes") {
            response = Self.notesResponse ?? .json(body: noteListJSON([]))
        } else {
            response = Self.chatsResponse ?? .json(body: chatListJSON([]))
        }
        let httpResponse = HTTPURLResponse(
            url: request.url!,
            statusCode: response.status,
            httpVersion: nil,
            headerFields: ["Content-Type": "application/json"]
        )!
        client?.urlProtocol(self, didReceive: httpResponse, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: response.body.data(using: .utf8)!)
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}

private struct FeedTestSessionStore: SessionStore {
    func load() throws -> CookieJar { CookieJar() }
    func save(_ cookieJar: CookieJar) throws {}
    func clear() throws {}
}

@MainActor
private func makeFeedDependencies() -> (NotesStore, ChatsStore, FeedViewModel) {
    let configuration = URLSessionConfiguration.ephemeral
    configuration.protocolClasses = [FeedMockProtocol.self]
    let client = APIClient(
        baseURL: feedBaseURL,
        sessionStore: FeedTestSessionStore(),
        configuration: configuration
    )
    let notesStore = NotesStore(service: NotesService(client: client))
    let chatsStore = ChatsStore(service: ChatsService(client: client))
    let feedVM = FeedViewModel(notesStore: notesStore, chatsStore: chatsStore)
    return (notesStore, chatsStore, feedVM)
}

// MARK: - FeedViewModelTests

@Suite("FeedViewModel", .serialized)
struct FeedViewModelTests {

    // MARK: Ordering

    @MainActor
    @Test("Merges notes and chats sorted by updatedAt descending")
    func feedSortsDescendingByUpdatedAt() async {
        FeedMockProtocol.shouldFail = false
        FeedMockProtocol.notesResponse = .json(body: noteListJSON([
            noteJSON(id: "n1", updatedAt: "2026-01-01T00:00:00.000Z"), // oldest
            noteJSON(id: "n2", updatedAt: "2026-03-01T00:00:00.000Z"), // newest
        ]))
        FeedMockProtocol.chatsResponse = .json(body: chatListJSON([
            chatJSON(id: "c1", updatedAt: "2026-02-01T00:00:00.000Z"), // middle
        ]))

        let (_, _, feedVM) = makeFeedDependencies()
        await feedVM.refresh()

        #expect(feedVM.items.count == 3)
        // Expected order: note n2 (Mar) > chat c1 (Feb) > note n1 (Jan)
        #expect(feedVM.items[0].id == "note-n2")
        #expect(feedVM.items[1].id == "chat-c1")
        #expect(feedVM.items[2].id == "note-n1")
    }

    @MainActor
    @Test("Chat newer than note sorts before note")
    func chatNewerThanNoteSortsFirst() async {
        FeedMockProtocol.shouldFail = false
        FeedMockProtocol.notesResponse = .json(body: noteListJSON([
            noteJSON(id: "n1", updatedAt: "2026-04-01T12:00:00.000Z"),
        ]))
        FeedMockProtocol.chatsResponse = .json(body: chatListJSON([
            chatJSON(id: "c1", updatedAt: "2026-04-01T13:00:00.000Z"), // 1 hr later
        ]))

        let (_, _, feedVM) = makeFeedDependencies()
        await feedVM.refresh()

        #expect(feedVM.items.count == 2)
        #expect(feedVM.items[0].id == "chat-c1") // chat is newer
        #expect(feedVM.items[1].id == "note-n1")
    }

    // MARK: Error propagation

    @MainActor
    @Test("Refresh surfaces error when network is unavailable")
    func feedSurfacesRefreshError() async {
        FeedMockProtocol.shouldFail = true
        FeedMockProtocol.notesResponse = nil
        FeedMockProtocol.chatsResponse = nil

        let (_, _, feedVM) = makeFeedDependencies()
        await feedVM.refresh()

        #expect(feedVM.error != nil)
        #expect(feedVM.isLoading == false)
    }

    @MainActor
    @Test("Failed refresh preserves previously loaded items in the feed")
    func feedPreservesPriorItemsOnFailure() async {
        // First: successful refresh populates the feed
        FeedMockProtocol.shouldFail = false
        FeedMockProtocol.notesResponse = .json(body: noteListJSON([
            noteJSON(id: "n1", updatedAt: "2026-01-01T00:00:00.000Z"),
        ]))
        FeedMockProtocol.chatsResponse = .json(body: chatListJSON([]))

        let (notesStore, _, feedVM) = makeFeedDependencies()
        await feedVM.refresh()
        #expect(feedVM.items.count == 1)

        // Second: failing refresh should NOT clear the notes already in the store
        FeedMockProtocol.shouldFail = true
        await feedVM.refresh()

        // Error is surfaced but prior store content is preserved
        #expect(feedVM.error != nil)
        #expect(notesStore.notes.count == 1) // notes unchanged by failure
        // items are rebuilt from whatever the store holds after the refresh
        #expect(feedVM.items.count == 1)
    }
}
