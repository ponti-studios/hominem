import Foundation

// MARK: - AppStores
//
// Singleton registry of all QueryStore instances.
// Screens observe these stores directly; the composer writes to them on submit.
// Sharing one instance per resource type means every screen sees the same
// cached data and benefits from the same stale-time window.

@Observable @MainActor
final class AppStores {

    static let shared = AppStores()

    let inbox: QueryStore<InboxItem>
    let notes: QueryStore<NoteItem>

    private init() {
        inbox = QueryStore(staleTime: 30) {
            try await InboxService.fetchItems()
        }
        notes = QueryStore(staleTime: 30) {
            try await NoteService.fetchNotes()
        }
    }

    // MARK: - Create

    /// Creates a new note, inserts it into both `notes` and `inbox`, and returns the detail for routing.
    func createNote() async throws -> NoteDetail {
        let detail = try await NoteService.createNote()
        let item = NoteItem(
            id: detail.id,
            title: detail.title,
            content: detail.content,
            createdAt: detail.createdAt,
            updatedAt: detail.updatedAt,
            hasAttachments: false
        )
        let inboxNote = InboxNote(
            id: detail.id,
            title: detail.title ?? "Untitled",
            excerpt: nil,
            updatedAt: detail.updatedAt
        )
        notes.mutateData { $0.insert(item, at: 0) }
        inbox.mutateData { $0.insert(.note(inboxNote), at: 0) }
        return detail
    }

    // MARK: - Archive / Delete helpers

    func archiveNote(id: String) async {
        let inboxSnapshot = inbox.data
        let notesSnapshot = notes.data
        inbox.mutateData { $0.removeAll { $0.id == "note-\(id)" } }
        notes.mutateData { $0.removeAll { $0.id == id } }
        do {
            try await NoteService.archiveNote(id: id)
        } catch {
            inbox.mutateData { $0 = inboxSnapshot }
            notes.mutateData { $0 = notesSnapshot }
        }
    }

    func deleteNote(id: String) async {
        let inboxSnapshot = inbox.data
        let notesSnapshot = notes.data
        inbox.mutateData { $0.removeAll { $0.id == "note-\(id)" } }
        notes.mutateData { $0.removeAll { $0.id == id } }
        do {
            try await NoteService.deleteNote(id: id)
        } catch {
            inbox.mutateData { $0 = inboxSnapshot }
            notes.mutateData { $0 = notesSnapshot }
        }
    }

    func archiveChat(id: String) async {
        let inboxSnapshot = inbox.data
        inbox.mutateData { $0.removeAll { $0.id == "chat-\(id)" } }
        do {
            try await ChatService.archiveChat(id: id)
        } catch {
            inbox.mutateData { $0 = inboxSnapshot }
        }
    }

    func deleteChat(id: String) async {
        let inboxSnapshot = inbox.data
        inbox.mutateData { $0.removeAll { $0.id == "chat-\(id)" } }
        do {
            try await ChatService.deleteChat(id: id)
        } catch {
            inbox.mutateData { $0 = inboxSnapshot }
        }
    }
}
