import Foundation
import Testing
@testable import Hakumi

// MARK: - SwipeActionTests
//
// Tests the archive / delete + rollback pattern used by InboxScreen and NotesScreen.
//
// The screen helpers are private, so we test the equivalent logic here by
// replicating the exact same operations (mutateData + service call + rollback).
// This is a characterization test: it asserts the *correct* cross-store behaviour
// so that a future refactor can't accidentally break it silently.
//
// Pattern under test (e.g. archive note from NotesScreen):
//   1. Remove from notes store optimistically
//   2. Remove from inbox store optimistically
//   3. Call NoteService.archiveNote
//   4. On failure: restore to notes store only (primary screen)
//
// Pattern under test (e.g. archive note from InboxScreen):
//   1. Remove from inbox store optimistically
//   2. Remove from notes store optimistically
//   3. Call NoteService.archiveNote
//   4. On failure: restore to inbox store only (primary screen)

private struct TestError: Error {}

@MainActor
struct SwipeActionTests {

    // MARK: - Fixtures

    private func makeNote(id: String = "n1") -> NoteItem {
        NoteItem(id: id, title: "Test", content: "Body",
                 createdAt: Date(), updatedAt: Date(), hasAttachments: false)
    }

    private func makeInboxNote(id: String = "n1") -> InboxNote {
        InboxNote(id: id, title: "Test", excerpt: nil, updatedAt: Date())
    }

    private func makeInboxChat(id: String = "c1") -> InboxChat {
        InboxChat(id: id, title: "Chat", activityAt: Date())
    }

    // MARK: - Helpers that mirror the screen helpers

    private func archiveNoteFromNotes(
        _ note: NoteItem,
        notes: QueryStore<NoteItem>,
        inbox: QueryStore<InboxItem>
    ) async {
        notes.mutateData { $0.removeAll { $0.id == note.id } }
        inbox.mutateData { $0.removeAll { $0.id == "note-\(note.id)" } }
        do {
            try await NoteService.archiveNote(id: note.id)
        } catch {
            notes.mutateData { $0.insert(note, at: 0) }
        }
    }

    private func deleteNoteFromNotes(
        _ note: NoteItem,
        notes: QueryStore<NoteItem>,
        inbox: QueryStore<InboxItem>
    ) async {
        notes.mutateData { $0.removeAll { $0.id == note.id } }
        inbox.mutateData { $0.removeAll { $0.id == "note-\(note.id)" } }
        do {
            try await NoteService.deleteNote(id: note.id)
        } catch {
            notes.mutateData { $0.insert(note, at: 0) }
        }
    }

    private func archiveNoteFromInbox(
        _ note: InboxNote,
        inbox: QueryStore<InboxItem>,
        notes: QueryStore<NoteItem>
    ) async {
        inbox.mutateData { $0.removeAll { $0.id == "note-\(note.id)" } }
        notes.mutateData { $0.removeAll { $0.id == note.id } }
        do {
            try await NoteService.archiveNote(id: note.id)
        } catch {
            inbox.mutateData { $0.insert(.note(note), at: 0) }
        }
    }

    private func deleteNoteFromInbox(
        _ note: InboxNote,
        inbox: QueryStore<InboxItem>,
        notes: QueryStore<NoteItem>
    ) async {
        inbox.mutateData { $0.removeAll { $0.id == "note-\(note.id)" } }
        notes.mutateData { $0.removeAll { $0.id == note.id } }
        do {
            try await NoteService.deleteNote(id: note.id)
        } catch {
            inbox.mutateData { $0.insert(.note(note), at: 0) }
        }
    }

    private func archiveChatFromInbox(
        _ chat: InboxChat,
        inbox: QueryStore<InboxItem>
    ) async {
        inbox.mutateData { $0.removeAll { $0.id == "chat-\(chat.id)" } }
        do {
            try await ChatService.archiveChat(id: chat.id)
        } catch {
            inbox.mutateData { $0.insert(.chat(chat), at: 0) }
        }
    }

    private func deleteChatFromInbox(
        _ chat: InboxChat,
        inbox: QueryStore<InboxItem>
    ) async {
        inbox.mutateData { $0.removeAll { $0.id == "chat-\(chat.id)" } }
        do {
            try await ChatService.deleteChat(id: chat.id)
        } catch {
            inbox.mutateData { $0.insert(.chat(chat), at: 0) }
        }
    }

    // MARK: - NotesScreen: archive note

    @Test func archiveNoteFromNotesRemovesFromBothStoresOnSuccess() async {
        let note = makeNote()
        let inboxNote = makeInboxNote()
        let notes = QueryStore<NoteItem> { [] }
        let inbox = QueryStore<InboxItem> { [] }
        notes.mutateData { $0 = [note] }
        inbox.mutateData { $0 = [.note(inboxNote)] }

        NoteService._testSession = MockURLProtocol.makeSession(statusCode: 200)
        defer { NoteService._testSession = nil }

        await archiveNoteFromNotes(note, notes: notes, inbox: inbox)

        #expect(notes.data.isEmpty, "note should be removed from notes store")
        #expect(inbox.data.isEmpty, "note should be removed from inbox store")
    }

    @Test func archiveNoteFromNotesRollsBackToNoteStoreOnFailure() async {
        let note = makeNote()
        let inboxNote = makeInboxNote()
        let notes = QueryStore<NoteItem> { [] }
        let inbox = QueryStore<InboxItem> { [] }
        notes.mutateData { $0 = [note] }
        inbox.mutateData { $0 = [.note(inboxNote)] }

        NoteService._testSession = MockURLProtocol.makeSession(statusCode: 500)
        defer { NoteService._testSession = nil }

        await archiveNoteFromNotes(note, notes: notes, inbox: inbox)

        #expect(notes.data.first?.id == note.id, "note should be restored in notes store")
        #expect(inbox.data.isEmpty, "rollback does NOT restore inbox (primary screen is notes)")
    }

    // MARK: - NotesScreen: delete note

    @Test func deleteNoteFromNotesRemovesFromBothStoresOnSuccess() async {
        let note = makeNote()
        let inboxNote = makeInboxNote()
        let notes = QueryStore<NoteItem> { [] }
        let inbox = QueryStore<InboxItem> { [] }
        notes.mutateData { $0 = [note] }
        inbox.mutateData { $0 = [.note(inboxNote)] }

        NoteService._testSession = MockURLProtocol.makeSession(statusCode: 200)
        defer { NoteService._testSession = nil }

        await deleteNoteFromNotes(note, notes: notes, inbox: inbox)

        #expect(notes.data.isEmpty)
        #expect(inbox.data.isEmpty)
    }

    @Test func deleteNoteFromNotesRollsBackToNoteStoreOnFailure() async {
        let note = makeNote()
        let notes = QueryStore<NoteItem> { [] }
        let inbox = QueryStore<InboxItem> { [] }
        notes.mutateData { $0 = [note] }

        NoteService._testSession = MockURLProtocol.makeSession(statusCode: 500)
        defer { NoteService._testSession = nil }

        await deleteNoteFromNotes(note, notes: notes, inbox: inbox)

        #expect(notes.data.first?.id == note.id)
        #expect(inbox.data.isEmpty)
    }

    // MARK: - InboxScreen: archive note

    @Test func archiveNoteFromInboxRemovesFromBothStoresOnSuccess() async {
        let inboxNote = makeInboxNote()
        let noteItem = makeNote()
        let inbox = QueryStore<InboxItem> { [] }
        let notes = QueryStore<NoteItem> { [] }
        inbox.mutateData { $0 = [.note(inboxNote)] }
        notes.mutateData { $0 = [noteItem] }

        NoteService._testSession = MockURLProtocol.makeSession(statusCode: 200)
        defer { NoteService._testSession = nil }

        await archiveNoteFromInbox(inboxNote, inbox: inbox, notes: notes)

        #expect(inbox.data.isEmpty, "note should be removed from inbox store")
        #expect(notes.data.isEmpty, "note should be removed from notes store")
    }

    @Test func archiveNoteFromInboxRollsBackToInboxStoreOnFailure() async {
        let inboxNote = makeInboxNote()
        let noteItem = makeNote()
        let inbox = QueryStore<InboxItem> { [] }
        let notes = QueryStore<NoteItem> { [] }
        inbox.mutateData { $0 = [.note(inboxNote)] }
        notes.mutateData { $0 = [noteItem] }

        NoteService._testSession = MockURLProtocol.makeSession(statusCode: 500)
        defer { NoteService._testSession = nil }

        await archiveNoteFromInbox(inboxNote, inbox: inbox, notes: notes)

        #expect(inbox.data.first?.id == "note-\(inboxNote.id)",
                "note should be restored in inbox store")
        #expect(notes.data.isEmpty, "rollback does NOT restore notes store (primary screen is inbox)")
    }

    // MARK: - InboxScreen: delete note

    @Test func deleteNoteFromInboxRemovesFromBothStoresOnSuccess() async {
        let inboxNote = makeInboxNote()
        let noteItem = makeNote()
        let inbox = QueryStore<InboxItem> { [] }
        let notes = QueryStore<NoteItem> { [] }
        inbox.mutateData { $0 = [.note(inboxNote)] }
        notes.mutateData { $0 = [noteItem] }

        NoteService._testSession = MockURLProtocol.makeSession(statusCode: 200)
        defer { NoteService._testSession = nil }

        await deleteNoteFromInbox(inboxNote, inbox: inbox, notes: notes)

        #expect(inbox.data.isEmpty)
        #expect(notes.data.isEmpty)
    }

    @Test func deleteNoteFromInboxRollsBackToInboxStoreOnFailure() async {
        let inboxNote = makeInboxNote()
        let inbox = QueryStore<InboxItem> { [] }
        let notes = QueryStore<NoteItem> { [] }
        inbox.mutateData { $0 = [.note(inboxNote)] }

        NoteService._testSession = MockURLProtocol.makeSession(statusCode: 500)
        defer { NoteService._testSession = nil }

        await deleteNoteFromInbox(inboxNote, inbox: inbox, notes: notes)

        #expect(inbox.data.first?.id == "note-\(inboxNote.id)")
        #expect(notes.data.isEmpty)
    }

    // MARK: - InboxScreen: archive chat

    @Test func archiveChatFromInboxRemovesOnSuccess() async {
        let chat = makeInboxChat()
        let inbox = QueryStore<InboxItem> { [] }
        inbox.mutateData { $0 = [.chat(chat)] }

        ChatService._testSession = MockURLProtocol.makeSession(statusCode: 200)
        defer { ChatService._testSession = nil }

        await archiveChatFromInbox(chat, inbox: inbox)

        #expect(inbox.data.isEmpty)
    }

    @Test func archiveChatFromInboxRollsBackOnFailure() async {
        let chat = makeInboxChat()
        let inbox = QueryStore<InboxItem> { [] }
        inbox.mutateData { $0 = [.chat(chat)] }

        ChatService._testSession = MockURLProtocol.makeSession(statusCode: 500)
        defer { ChatService._testSession = nil }

        await archiveChatFromInbox(chat, inbox: inbox)

        #expect(inbox.data.first?.id == "chat-\(chat.id)")
    }

    // MARK: - InboxScreen: delete chat

    @Test func deleteChatFromInboxRemovesOnSuccess() async {
        let chat = makeInboxChat()
        let inbox = QueryStore<InboxItem> { [] }
        inbox.mutateData { $0 = [.chat(chat)] }

        ChatService._testSession = MockURLProtocol.makeSession(statusCode: 200)
        defer { ChatService._testSession = nil }

        await deleteChatFromInbox(chat, inbox: inbox)

        #expect(inbox.data.isEmpty)
    }

    @Test func deleteChatFromInboxRollsBackOnFailure() async {
        let chat = makeInboxChat()
        let inbox = QueryStore<InboxItem> { [] }
        inbox.mutateData { $0 = [.chat(chat)] }

        ChatService._testSession = MockURLProtocol.makeSession(statusCode: 500)
        defer { ChatService._testSession = nil }

        await deleteChatFromInbox(chat, inbox: inbox)

        #expect(inbox.data.first?.id == "chat-\(chat.id)")
    }

    // MARK: - Multiple items: only target is removed

    @Test func archiveNoteDoesNotAffectSiblingItems() async {
        let noteA = makeNote(id: "a")
        let noteB = makeNote(id: "b")
        let notes = QueryStore<NoteItem> { [] }
        notes.mutateData { $0 = [noteA, noteB] }

        NoteService._testSession = MockURLProtocol.makeSession(statusCode: 200)
        defer { NoteService._testSession = nil }

        let inbox = QueryStore<InboxItem> { [] }
        await archiveNoteFromNotes(noteA, notes: notes, inbox: inbox)

        #expect(notes.data.count == 1)
        #expect(notes.data.first?.id == "b")
    }

    @Test func rollbackInsertsAtFrontPreservingSiblings() async {
        let noteA = makeNote(id: "a")
        let noteB = makeNote(id: "b")
        let notes = QueryStore<NoteItem> { [] }
        notes.mutateData { $0 = [noteA, noteB] }

        NoteService._testSession = MockURLProtocol.makeSession(statusCode: 500)
        defer { NoteService._testSession = nil }

        let inbox = QueryStore<InboxItem> { [] }
        await archiveNoteFromNotes(noteA, notes: notes, inbox: inbox)

        // noteA is rolled back to front; noteB is still present
        #expect(notes.data.first?.id == "a")
        #expect(notes.data.count == 2)
    }
}
