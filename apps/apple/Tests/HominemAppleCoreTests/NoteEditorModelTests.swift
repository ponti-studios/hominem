import Foundation
import Testing
@testable import HominemAppleCore

// MARK: - Fixtures

private let editorBaseURL = URL(string: "http://localhost:4040")!

private let editorSampleNoteJSON = #"""
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

private let editorSampleNote = Note(
    id: "note-1",
    userId: "user-1",
    type: .note,
    status: .draft,
    title: "Test Note",
    content: "Hello world",
    excerpt: nil,
    tags: [],
    mentions: nil,
    analysis: nil,
    parentNoteId: nil,
    files: [],
    versionNumber: 1,
    isLatestVersion: true,
    publishedAt: nil,
    scheduledFor: nil,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
)

// MARK: - Mock URLProtocol

private final class EditorMockProtocol: URLProtocol, @unchecked Sendable {
    nonisolated(unsafe) static var responseBody: String = editorSampleNoteJSON
    nonisolated(unsafe) static var responseStatus: Int = 200
    nonisolated(unsafe) static var requestCount: Int = 0
    nonisolated(unsafe) static var shouldFail = false

    static func reset(body: String = editorSampleNoteJSON, status: Int = 200, fail: Bool = false) {
        responseBody = body
        responseStatus = status
        requestCount = 0
        shouldFail = fail
    }

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        Self.requestCount += 1
        if Self.shouldFail {
            client?.urlProtocol(self, didFailWithError: URLError(.notConnectedToInternet))
            return
        }
        let response = HTTPURLResponse(
            url: request.url!,
            statusCode: Self.responseStatus,
            httpVersion: nil,
            headerFields: ["Content-Type": "application/json"]
        )!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Self.responseBody.data(using: .utf8)!)
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}

private struct EditorTestSessionStore: SessionStore {
    func load() throws -> CookieJar { CookieJar() }
    func save(_ cookieJar: CookieJar) throws {}
    func clear() throws {}
}

@MainActor
private func makeEditorDependencies() -> (NotesStore, NoteDetailViewModel) {
    let configuration = URLSessionConfiguration.ephemeral
    configuration.protocolClasses = [EditorMockProtocol.self]
    let client = APIClient(
        baseURL: editorBaseURL,
        sessionStore: EditorTestSessionStore(),
        configuration: configuration
    )
    let notesStore = NotesStore(service: NotesService(client: client))
    // Use a short debounce delay so tests don't take seconds
    let vm = NoteDetailViewModel(note: editorSampleNote, notesStore: notesStore, debounceDelay: .milliseconds(50))
    return (notesStore, vm)
}

// MARK: - NoteEditorModelTests

@Suite("NoteDetailViewModel", .serialized)
struct NoteEditorModelTests {

    // MARK: Debounce collapse

    @MainActor
    @Test("Rapid edits collapse into a single save request")
    func rapidEditsCollapseToOneSave() async throws {
        EditorMockProtocol.reset()
        let (_, vm) = makeEditorDependencies()

        // Fire several rapid edits
        vm.editedContent = "Edit 1"
        vm.scheduleAutoSave()
        vm.editedContent = "Edit 2"
        vm.scheduleAutoSave()
        vm.editedContent = "Edit 3"
        vm.scheduleAutoSave()

        // Wait for the debounce to fire (50 ms) plus a little headroom
        try await Task.sleep(for: .milliseconds(150))

        // Only the last scheduled save should have fired
        #expect(EditorMockProtocol.requestCount == 1)
        #expect(vm.saveState != .saving)
    }

    // MARK: Immediate flush on disappear

    @MainActor
    @Test("Pending save flushes immediately when flushPendingSave is called")
    func flushesImmediatelyOnDisappear() async throws {
        EditorMockProtocol.reset()
        let (_, vm) = makeEditorDependencies()

        // Schedule an auto-save with a very long debounce so it won't fire on its own
        let longDelayVM = NoteDetailViewModel(
            note: editorSampleNote,
            notesStore: {
                let configuration = URLSessionConfiguration.ephemeral
                configuration.protocolClasses = [EditorMockProtocol.self]
                let client = APIClient(
                    baseURL: editorBaseURL,
                    sessionStore: EditorTestSessionStore(),
                    configuration: configuration
                )
                return NotesStore(service: NotesService(client: client))
            }(),
            debounceDelay: .seconds(60)  // would never fire in test
        )

        longDelayVM.editedContent = "Changed content"
        longDelayVM.scheduleAutoSave()

        // State should be .saving (pending)
        #expect(longDelayVM.saveState == .saving)

        // Simulating .onDisappear
        await longDelayVM.flushPendingSave()

        // The save must have fired synchronously
        #expect(EditorMockProtocol.requestCount == 1)
        #expect(longDelayVM.saveState == .saved || longDelayVM.saveState == .idle)
    }

    // MARK: No flush when idle

    @MainActor
    @Test("flushPendingSave does nothing when no save is pending")
    func flushDoesNothingWhenIdle() async throws {
        EditorMockProtocol.reset()
        let (_, vm) = makeEditorDependencies()

        // No scheduleAutoSave called — saveState is .idle
        #expect(vm.saveState == .idle)

        await vm.flushPendingSave()

        // Should not have triggered a network request
        #expect(EditorMockProtocol.requestCount == 0)
        #expect(vm.saveState == .idle)
    }

    // MARK: Save failure state

    @MainActor
    @Test("Save failure transitions saveState to .failed")
    func saveFailureSetsFailedState() async throws {
        EditorMockProtocol.reset(fail: true)
        let (_, vm) = makeEditorDependencies()

        vm.editedContent = "Content that will fail"
        let success = await vm.performSave()

        #expect(success == false)
        #expect(vm.saveState == .failed)
    }

    @MainActor
    @Test("Successful save transitions saveState to .saved then .idle")
    func successfulSaveTransitionsState() async throws {
        EditorMockProtocol.reset()
        let (_, vm) = makeEditorDependencies()

        vm.editedContent = "Updated content"
        let success = await vm.performSave()

        #expect(success == true)
        // Immediately after the save completes state should be .saved or .idle
        // (the 2-second idle transition may or may not have fired)
        #expect(vm.saveState == .saved || vm.saveState == .idle)
        #expect(EditorMockProtocol.requestCount == 1)
    }
}
