import Foundation
import Testing
@testable import Hakumi

// MARK: - NoteServiceTests
//
// Tests cover: response parsing, error mapping, HTTP method/path correctness,
// and the archive / delete operations added for swipe actions.
//
// Network is intercepted via MockURLProtocol; no real server is needed.

@MainActor
struct NoteServiceTests {

    // MARK: - Helpers

    /// ISO 8601 timestamp used across fixtures.
    private let ts = "2024-03-15T10:30:00.000Z"

    private func noteListJSON(notes: [[String: Any]] = []) -> Data {
        MockURLProtocol.json(["notes": notes])
    }

    private func noteDict(
        id: String = "note-1",
        title: String? = "Test Note",
        content: String = "Hello",
        files: [[String: Any]] = []
    ) -> [String: Any] {
        var d: [String: Any] = [
            "id": id,
            "content": content,
            "createdAt": ts,
            "updatedAt": ts,
            "files": files
        ]
        if let title { d["title"] = title }
        return d
    }

    // MARK: - fetchNotes

    @Test func fetchNotesReturnsEmptyArrayOnEmptyResponse() async throws {
        NoteService._testSession = MockURLProtocol.makeSession(body: noteListJSON())
        defer { NoteService._testSession = nil }

        let notes = try await NoteService.fetchNotes()
        #expect(notes.isEmpty)
    }

    @Test func fetchNotesParsesNoteItems() async throws {
        let body = noteListJSON(notes: [
            noteDict(id: "n1", title: "First",  content: "aaa"),
            noteDict(id: "n2", title: "Second", content: "bbb")
        ])
        NoteService._testSession = MockURLProtocol.makeSession(body: body)
        defer { NoteService._testSession = nil }

        let notes = try await NoteService.fetchNotes()
        #expect(notes.count == 2)
        #expect(notes[0].id == "n1")
        #expect(notes[0].title == "First")
        #expect(notes[1].id == "n2")
    }

    @Test func fetchNotesSkipsMalformedEntries() async throws {
        let body = noteListJSON(notes: [
            ["id": "n1", "content": "ok", "updatedAt": ts],  // valid
            ["content": "no-id"]                              // missing id — skipped
        ])
        NoteService._testSession = MockURLProtocol.makeSession(body: body)
        defer { NoteService._testSession = nil }

        let notes = try await NoteService.fetchNotes()
        #expect(notes.count == 1)
        #expect(notes[0].id == "n1")
    }

    @Test func fetchNotesThrowsOnServerError() async throws {
        NoteService._testSession = MockURLProtocol.makeSession(statusCode: 401)
        defer { NoteService._testSession = nil }

        do {
            _ = try await NoteService.fetchNotes()
            Issue.record("Expected NoteError.fetchFailed to be thrown")
        } catch let error as NoteError {
            #expect(error == .fetchFailed)
        }
    }

    @Test func fetchNotesSetsHasAttachmentsTrueWhenFilesPresent() async throws {
        let body = noteListJSON(notes: [
            noteDict(id: "n1", files: [["id": "f1", "originalName": "photo.jpg"]])
        ])
        NoteService._testSession = MockURLProtocol.makeSession(body: body)
        defer { NoteService._testSession = nil }

        let notes = try await NoteService.fetchNotes()
        #expect(notes.first?.hasAttachments == true)
    }

    @Test func fetchNotesRequestUsesGetMethod() async throws {
        var capturedRequest: URLRequest?
        NoteService._testSession = MockURLProtocol.makeSession { request in
            capturedRequest = request
            return (200, self.noteListJSON())
        }
        defer { NoteService._testSession = nil }

        _ = try await NoteService.fetchNotes()
        // Default is GET when httpMethod is nil
        let method = capturedRequest?.httpMethod ?? "GET"
        #expect(method == "GET")
        #expect(capturedRequest?.url?.path.contains("/api/notes") == true)
    }

    // MARK: - fetchNote

    @Test func fetchNoteReturnsParsedDetail() async throws {
        let body = MockURLProtocol.json(noteDict(
            id: "n1",
            title: "Detail Note",
            content: "Detailed content"
        ))
        NoteService._testSession = MockURLProtocol.makeSession(body: body)
        defer { NoteService._testSession = nil }

        let detail = try await NoteService.fetchNote(id: "n1")
        #expect(detail.id == "n1")
        #expect(detail.title == "Detail Note")
        #expect(detail.content == "Detailed content")
    }

    @Test func fetchNoteThrowsInvalidResponseOnBadBody() async throws {
        NoteService._testSession = MockURLProtocol.makeSession(body: MockURLProtocol.json(["bad": "shape"]))
        defer { NoteService._testSession = nil }

        do {
            _ = try await NoteService.fetchNote(id: "n1")
            Issue.record("Expected NoteError.invalidResponse")
        } catch let error as NoteError {
            #expect(error == .invalidResponse)
        }
    }

    @Test func fetchNoteThrowsOnServerError() async throws {
        NoteService._testSession = MockURLProtocol.makeSession(statusCode: 404)
        defer { NoteService._testSession = nil }

        do {
            _ = try await NoteService.fetchNote(id: "n1")
            Issue.record("Expected NoteError.fetchFailed")
        } catch let error as NoteError {
            #expect(error == .fetchFailed)
        }
    }

    // MARK: - createNote

    @Test func createNoteReturnsDetail() async throws {
        let body = MockURLProtocol.json(noteDict(id: "new-1", content: ""))
        NoteService._testSession = MockURLProtocol.makeSession(body: body)
        defer { NoteService._testSession = nil }

        let detail = try await NoteService.createNote()
        #expect(detail.id == "new-1")
        #expect(detail.content == "")
    }

    @Test func createNoteUsesPostMethod() async throws {
        var capturedRequest: URLRequest?
        let body = MockURLProtocol.json(noteDict(id: "new-1"))
        NoteService._testSession = MockURLProtocol.makeSession { request in
            capturedRequest = request
            return (201, body)
        }
        defer { NoteService._testSession = nil }

        _ = try await NoteService.createNote()
        #expect(capturedRequest?.httpMethod == "POST")
        #expect(capturedRequest?.url?.path == "/api/notes")
    }

    @Test func createNoteThrowsOnServerError() async throws {
        NoteService._testSession = MockURLProtocol.makeSession(statusCode: 500)
        defer { NoteService._testSession = nil }

        do {
            _ = try await NoteService.createNote()
            Issue.record("Expected NoteError.saveFailed")
        } catch let error as NoteError {
            #expect(error == .saveFailed)
        }
    }

    // MARK: - createNoteWithContent

    @Test func createNoteWithContentSendsBodyAndReturnsDetail() async throws {
        var capturedBody: [String: Any]?
        let body = MockURLProtocol.json(noteDict(id: "c1", content: "My content"))
        NoteService._testSession = MockURLProtocol.makeSession { request in
            if let data = MockURLProtocol.bodyData(from: request) {
                capturedBody = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            }
            return (201, body)
        }
        defer { NoteService._testSession = nil }

        let detail = try await NoteService.createNoteWithContent(content: "My content")
        #expect(detail.id == "c1")
        #expect(capturedBody?["content"] as? String == "My content")
    }

    @Test func createNoteWithContentIncludesFileIds() async throws {
        var capturedBody: [String: Any]?
        let body = MockURLProtocol.json(noteDict(id: "c2"))
        NoteService._testSession = MockURLProtocol.makeSession { request in
            if let data = MockURLProtocol.bodyData(from: request) {
                capturedBody = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            }
            return (201, body)
        }
        defer { NoteService._testSession = nil }

        _ = try await NoteService.createNoteWithContent(content: "text", fileIds: ["f1", "f2"])
        #expect((capturedBody?["fileIds"] as? [String]) == ["f1", "f2"])
    }

    // MARK: - saveNote

    @Test func saveNoteSendsPatchWithBodyAndReturnsDetail() async throws {
        var capturedRequest: URLRequest?
        var capturedBody: [String: Any]?
        let body = MockURLProtocol.json(noteDict(id: "n1", title: "Updated", content: "New content"))
        NoteService._testSession = MockURLProtocol.makeSession { request in
            capturedRequest = request
            if let data = MockURLProtocol.bodyData(from: request) {
                capturedBody = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            }
            return (200, body)
        }
        defer { NoteService._testSession = nil }

        let detail = try await NoteService.saveNote(id: "n1", title: "Updated", content: "New content")
        #expect(capturedRequest?.httpMethod == "PATCH")
        #expect(capturedRequest?.url?.path == "/api/notes/n1")
        #expect(capturedBody?["content"] as? String == "New content")
        #expect(capturedBody?["title"] as? String == "Updated")
        #expect(detail.title == "Updated")
    }

    @Test func saveNoteWithNilTitleSendsNullInBody() async throws {
        var capturedBody: [String: Any]?
        let body = MockURLProtocol.json(noteDict(id: "n1", title: nil))
        NoteService._testSession = MockURLProtocol.makeSession { request in
            if let data = MockURLProtocol.bodyData(from: request) {
                capturedBody = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            }
            return (200, body)
        }
        defer { NoteService._testSession = nil }

        _ = try await NoteService.saveNote(id: "n1", title: nil, content: "")
        // NSNull becomes NSNull in the dictionary — key must be present
        #expect(capturedBody?.keys.contains("title") == true)
    }

    @Test func saveNoteThrowsOnServerError() async throws {
        NoteService._testSession = MockURLProtocol.makeSession(statusCode: 403)
        defer { NoteService._testSession = nil }

        do {
            _ = try await NoteService.saveNote(id: "n1", title: nil, content: "")
            Issue.record("Expected NoteError.saveFailed")
        } catch let error as NoteError {
            #expect(error == .saveFailed)
        }
    }

    // MARK: - archiveNote

    @Test func archiveNoteSucceedsOnOkResponse() async throws {
        NoteService._testSession = MockURLProtocol.makeSession(statusCode: 200)
        defer { NoteService._testSession = nil }

        try await NoteService.archiveNote(id: "n1")
        // No throw == success
    }

    @Test func archiveNoteUsesPostToArchivePath() async throws {
        var capturedRequest: URLRequest?
        NoteService._testSession = MockURLProtocol.makeSession { request in
            capturedRequest = request
            return (200, Data())
        }
        defer { NoteService._testSession = nil }

        try await NoteService.archiveNote(id: "n1")
        #expect(capturedRequest?.httpMethod == "POST")
        #expect(capturedRequest?.url?.path == "/api/notes/n1/archive")
    }

    @Test func archiveNoteThrowsOnServerError() async throws {
        NoteService._testSession = MockURLProtocol.makeSession(statusCode: 422)
        defer { NoteService._testSession = nil }

        do {
            try await NoteService.archiveNote(id: "n1")
            Issue.record("Expected NoteError.saveFailed")
        } catch let error as NoteError {
            #expect(error == .saveFailed)
        }
    }

    // MARK: - deleteNote

    @Test func deleteNoteSucceedsOnOkResponse() async throws {
        NoteService._testSession = MockURLProtocol.makeSession(statusCode: 200)
        defer { NoteService._testSession = nil }

        try await NoteService.deleteNote(id: "n1")
    }

    @Test func deleteNoteUsesDeleteMethod() async throws {
        var capturedRequest: URLRequest?
        NoteService._testSession = MockURLProtocol.makeSession { request in
            capturedRequest = request
            return (200, Data())
        }
        defer { NoteService._testSession = nil }

        try await NoteService.deleteNote(id: "n1")
        #expect(capturedRequest?.httpMethod == "DELETE")
        #expect(capturedRequest?.url?.path == "/api/notes/n1")
    }

    @Test func deleteNoteThrowsOnServerError() async throws {
        NoteService._testSession = MockURLProtocol.makeSession(statusCode: 500)
        defer { NoteService._testSession = nil }

        do {
            try await NoteService.deleteNote(id: "n1")
            Issue.record("Expected NoteError.saveFailed")
        } catch let error as NoteError {
            #expect(error == .saveFailed)
        }
    }

    // MARK: - Date parsing

    @Test func fetchNotesParsesISO8601WithFractionalSeconds() async throws {
        let body = noteListJSON(notes: [
            ["id": "n1", "content": "x", "updatedAt": "2024-03-15T10:30:00.123Z"]
        ])
        NoteService._testSession = MockURLProtocol.makeSession(body: body)
        defer { NoteService._testSession = nil }

        let notes = try await NoteService.fetchNotes()
        #expect(notes.first?.updatedAt != nil)
    }

    @Test func fetchNotesParsesISO8601WithoutFractionalSeconds() async throws {
        let body = noteListJSON(notes: [
            ["id": "n1", "content": "x", "updatedAt": "2024-03-15T10:30:00Z"]
        ])
        NoteService._testSession = MockURLProtocol.makeSession(body: body)
        defer { NoteService._testSession = nil }

        let notes = try await NoteService.fetchNotes()
        #expect(notes.first?.updatedAt != nil)
    }
}
