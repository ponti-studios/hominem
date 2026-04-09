import Foundation
import Testing
@testable import HominemAppleCore

// MARK: - Helpers

private let baseURL = URL(string: "http://localhost:4040")!

private func makeClient(protocol protocolClass: URLProtocol.Type) -> APIClient {
    let configuration = URLSessionConfiguration.ephemeral
    configuration.protocolClasses = [protocolClass]
    return APIClient(
        baseURL: baseURL,
        sessionStore: NotesTestSessionStore(),
        configuration: configuration
    )
}

private let sampleNoteJSON = #"""
{
    "id": "note-1",
    "userId": "user-1",
    "type": "note",
    "status": "draft",
    "title": "Test Note",
    "content": "Hello world",
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
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
}
"""#

private func noteListJSON(notes: String = sampleNoteJSON) -> String {
    #"{"notes":[\#(notes)]}"#
}

// MARK: - NotesServiceTests

@Suite(.serialized)
struct NotesServiceTests {

    // MARK: listNotes

    @MainActor
    @Test
    func listNotesDecodesNoteArray() async throws {
        NotesProtocol.handler = { request in
            #expect(request.url?.path == "/api/notes")
            #expect(request.httpMethod == "GET")
            return .json(status: 200, body: noteListJSON())
        }
        let service = NotesService(client: makeClient(protocol: NotesProtocol.self))
        let notes = try await service.listNotes()
        #expect(notes.count == 1)
        #expect(notes[0].id == "note-1")
        #expect(notes[0].title == "Test Note")
        #expect(notes[0].content == "Hello world")
    }

    @MainActor
    @Test
    func listNotesForwardsQueryParameters() async throws {
        NotesProtocol.handler = { request in
            let components = URLComponents(url: request.url!, resolvingAgainstBaseURL: false)
            let items = components?.queryItems ?? []
            #expect(items.contains(URLQueryItem(name: "types", value: "note")))
            #expect(items.contains(URLQueryItem(name: "limit", value: "10")))
            return .json(status: 200, body: noteListJSON())
        }
        let service = NotesService(client: makeClient(protocol: NotesProtocol.self))
        let query = NotesListQuery(types: [.note], limit: 10)
        _ = try await service.listNotes(query: query)
    }

    // MARK: getNote

    @MainActor
    @Test
    func getNoteRequestsCorrectPath() async throws {
        NotesProtocol.handler = { request in
            #expect(request.url?.path == "/api/notes/note-1")
            #expect(request.httpMethod == "GET")
            return .json(status: 200, body: sampleNoteJSON)
        }
        let service = NotesService(client: makeClient(protocol: NotesProtocol.self))
        let note = try await service.getNote(id: "note-1")
        #expect(note.id == "note-1")
    }

    // MARK: createNote

    @MainActor
    @Test
    func createNotePostsToNotesEndpoint() async throws {
        NotesProtocol.handler = { request in
            #expect(request.url?.path == "/api/notes")
            #expect(request.httpMethod == "POST")
            return .json(status: 200, body: sampleNoteJSON)
        }
        let service = NotesService(client: makeClient(protocol: NotesProtocol.self))
        let note = try await service.createNote(input: NotesCreateInput(content: "Hello world"))
        #expect(note.id == "note-1")
    }

    // MARK: updateNote

    @MainActor
    @Test
    func updateNotePatchesCorrectPath() async throws {
        NotesProtocol.handler = { request in
            #expect(request.url?.path == "/api/notes/note-1")
            #expect(request.httpMethod == "PATCH")
            return .json(status: 200, body: sampleNoteJSON)
        }
        let service = NotesService(client: makeClient(protocol: NotesProtocol.self))
        let note = try await service.updateNote(
            id: "note-1",
            input: NotesUpdateInput(content: "Updated content")
        )
        #expect(note.id == "note-1")
    }

    // MARK: deleteNote

    @MainActor
    @Test
    func deleteNoteDeletesCorrectPath() async throws {
        NotesProtocol.handler = { request in
            #expect(request.url?.path == "/api/notes/note-1")
            #expect(request.httpMethod == "DELETE")
            return .json(status: 200, body: sampleNoteJSON)
        }
        let service = NotesService(client: makeClient(protocol: NotesProtocol.self))
        let note = try await service.deleteNote(id: "note-1")
        #expect(note.id == "note-1")
    }

    // MARK: archiveNote

    @MainActor
    @Test
    func archiveNotePostsToArchivePath() async throws {
        NotesProtocol.handler = { request in
            #expect(request.url?.path == "/api/notes/note-1/archive")
            #expect(request.httpMethod == "POST")
            return .json(status: 200, body: sampleNoteJSON)
        }
        let service = NotesService(client: makeClient(protocol: NotesProtocol.self))
        let note = try await service.archiveNote(id: "note-1")
        #expect(note.id == "note-1")
    }

    // MARK: classifyNote

    @MainActor
    @Test
    func classifyNotePostsContentAndReturnsReviewId() async throws {
        let classifyJSON = #"""
        {
            "reviewItemId": "review-1",
            "proposedTitle": "My Note",
            "proposedChanges": ["add title"],
            "previewContent": "Hello world"
        }
        """#
        NotesProtocol.handler = { request in
            #expect(request.url?.path == "/api/notes/classify")
            #expect(request.httpMethod == "POST")
            return .json(status: 200, body: classifyJSON)
        }
        let service = NotesService(client: makeClient(protocol: NotesProtocol.self))
        let result = try await service.classifyNote(content: "Hello world")
        #expect(result.reviewItemId == "review-1")
        #expect(result.proposedTitle == "My Note")
    }

    // MARK: updateNote clears title

    @MainActor
    @Test
    func updateNoteEncodesNullTitleWhenCleared() async throws {
        NotesProtocol.capturedBody = nil
        NotesProtocol.handler = { _ in
            .json(status: 200, body: sampleNoteJSON)
        }
        let service = NotesService(client: makeClient(protocol: NotesProtocol.self))
        _ = try await service.updateNote(id: "note-1", input: NotesUpdateInput(clearTitle: true))

        let body = try #require(NotesProtocol.capturedBody)
        let json = try JSONSerialization.jsonObject(with: body) as? [String: Any]
        #expect(json?["title"] is NSNull)
    }
}

// MARK: - Test infrastructure

private final class NotesProtocol: URLProtocol, @unchecked Sendable {
    struct MockResponse {
        let status: Int
        let body: String

        static func json(status: Int, body: String) -> MockResponse {
            MockResponse(status: status, body: body)
        }
    }

    nonisolated(unsafe) static var handler: (@Sendable (URLRequest) -> MockResponse)?
    nonisolated(unsafe) static var capturedBody: Data?

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        // URLSession converts httpBody → httpBodyStream before handing to URLProtocol.
        if let stream = request.httpBodyStream {
            stream.open()
            var data = Data()
            let buffer = UnsafeMutablePointer<UInt8>.allocate(capacity: 4096)
            defer { buffer.deallocate() }
            while stream.hasBytesAvailable {
                let n = stream.read(buffer, maxLength: 4096)
                guard n > 0 else { break }
                data.append(buffer, count: n)
            }
            stream.close()
            Self.capturedBody = data
        } else {
            Self.capturedBody = request.httpBody
        }

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

private struct NotesTestSessionStore: SessionStore {
    func load() throws -> CookieJar { CookieJar() }
    func save(_ cookieJar: CookieJar) throws {}
    func clear() throws {}
}
