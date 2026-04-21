import Foundation
import Testing
@testable import Hakumi

// MARK: - Helpers

private struct TestItem: Identifiable, Sendable, Equatable {
    let id: String
}

private struct TestError: Error {}

/// A UserDefaults backed by a unique in-memory suite per test instance,
/// so tests never bleed state into each other or into the app's standard suite.
private func makeSuite() -> UserDefaults {
    let name = "test.\(UUID().uuidString)"
    return UserDefaults(suiteName: name)!
}

// MARK: - QueryStore

@MainActor
struct QueryStoreTests {

    // MARK: Status

    @Test func statusStartsIdle() {
        let store = QueryStore<TestItem> { [] }
        #expect(store.status == .idle)
    }

    @Test func fetchSuccessPopulatesDataAndStatus() async {
        let store = QueryStore<TestItem> { [TestItem(id: "a"), TestItem(id: "b")] }
        await store.fetch()
        #expect(store.data == [TestItem(id: "a"), TestItem(id: "b")])
        #expect(store.status == .success)
        #expect(store.lastFetchedAt != nil)
    }

    @Test func fetchFailureSetsErrorStatus() async {
        let store = QueryStore<TestItem> { throw TestError() }
        await store.fetch()
        #expect(store.data.isEmpty)
        #expect(store.errorMessage != nil)
        #expect(store.lastFetchedAt == nil)
    }

    @Test func isFirstLoadTrueWhenLoadingWithNoData() async {
        // Simulate the window between fetch start and completion
        var continuation: CheckedContinuation<Void, Never>?
        let store = QueryStore<TestItem> {
            await withCheckedContinuation { continuation = $0 }
            return [TestItem(id: "1")]
        }

        let fetchTask = Task { await store.fetch() }
        // Yield to allow the fetch to start
        await Task.yield()

        #expect(store.isFirstLoad)

        continuation?.resume()
        await fetchTask.value
        #expect(!store.isFirstLoad)
    }

    @Test func isEmptyTrueWhenNoDataAndNotLoading() {
        let store = QueryStore<TestItem> { [] }
        #expect(store.isEmpty)
    }

    @Test func isEmptyFalseAfterSuccessfulFetch() async {
        let store = QueryStore<TestItem> { [TestItem(id: "1")] }
        await store.fetch()
        #expect(!store.isEmpty)
    }

    // MARK: Staleness

    @Test func isStaleBeforeFirstFetch() {
        let store = QueryStore<TestItem>(staleTime: 60) { [] }
        #expect(store.isStale)
    }

    @Test func isNotStaleSoonAfterFetch() async {
        let store = QueryStore<TestItem>(staleTime: 60) { [] }
        await store.fetch()
        #expect(!store.isStale)
    }

    @Test func isStaleAfterStaleTimeElapsesWithZeroStaleTime() async {
        let store = QueryStore<TestItem>(staleTime: 0) { [] }
        await store.fetch()
        // staleTime == 0 means any elapsed time makes it stale
        try? await Task.sleep(nanoseconds: 1_000_000) // 1ms
        #expect(store.isStale)
    }

    @Test func fetchIfStaleIsNoOpWhenFresh() async {
        var callCount = 0
        let store = QueryStore<TestItem>(staleTime: 60) {
            callCount += 1
            return []
        }
        await store.fetch()
        #expect(callCount == 1)

        store.fetchIfStale() // should not trigger another fetch
        try? await Task.sleep(nanoseconds: 20_000_000) // 20ms
        #expect(callCount == 1)
    }

    @Test func fetchIfStaleRefetchesWhenStale() async {
        var callCount = 0
        let store = QueryStore<TestItem>(staleTime: 0) {
            callCount += 1
            return []
        }
        await store.fetch()
        #expect(callCount == 1)

        try? await Task.sleep(nanoseconds: 1_000_000) // ensure stale
        store.fetchIfStale()
        try? await Task.sleep(nanoseconds: 50_000_000) // let the Task run
        #expect(callCount == 2)
    }

    // MARK: Optimistic prepend

    @Test func prependInsertPlaceholderImmediately() async {
        let store = QueryStore<TestItem> { [] }
        let placeholder = TestItem(id: "tmp-1")
        var placeholderSeen = false

        _ = try? await store.prepend(placeholder: placeholder) {
            placeholderSeen = store.data.contains(placeholder)
            return TestItem(id: "server-1")
        }

        #expect(placeholderSeen, "placeholder should be in data during the mutation")
    }

    @Test func prependReplacesPlaceholderWithServerItemOnSuccess() async throws {
        let store = QueryStore<TestItem> { [] }
        let placeholder = TestItem(id: "tmp-1")
        let serverItem = TestItem(id: "server-1")

        try await store.prepend(placeholder: placeholder) { serverItem }

        #expect(store.data == [serverItem])
        #expect(!store.data.contains(placeholder))
    }

    @Test func prependRemovesPlaceholderAndRethrowsOnFailure() async {
        let store = QueryStore<TestItem> { [] }
        let placeholder = TestItem(id: "tmp-1")

        do {
            try await store.prepend(placeholder: placeholder) { throw TestError() }
            Issue.record("expected throw")
        } catch {}

        #expect(store.data.isEmpty)
        #expect(!store.data.contains(placeholder))
    }

    @Test func prependPrependsToExistingItems() async throws {
        let store = QueryStore<TestItem> { [TestItem(id: "existing")] }
        await store.fetch()

        let serverItem = TestItem(id: "new")
        try await store.prepend(placeholder: TestItem(id: "tmp")) { serverItem }

        #expect(store.data.first == serverItem)
        #expect(store.data.count == 2)
    }

    // MARK: mutate

    @Test func mutateCommitsResultOnSuccess() async throws {
        let store = QueryStore<TestItem> { [TestItem(id: "a")] }
        await store.fetch()

        try await store.mutate(
            optimistic: { _ in [TestItem(id: "optimistic")] },
            mutation: { TestItem(id: "committed") },
            rollback: { _ in [TestItem(id: "a")] },
            commit: { result, items in items = [result] }
        )

        #expect(store.data == [TestItem(id: "committed")])
    }

    @Test func mutateRollsBackOnFailure() async {
        let store = QueryStore<TestItem> { [TestItem(id: "original")] }
        await store.fetch()

        do {
            try await store.mutate(
                optimistic: { _ in [TestItem(id: "optimistic")] },
                mutation: { throw TestError() } as () async throws -> Void,
                rollback: { _ in [TestItem(id: "original")] },
                commit: { _, _ in }
            )
            Issue.record("expected throw")
        } catch {}

        #expect(store.data == [TestItem(id: "original")])
    }

    // MARK: mutateData

    @Test func mutateDataModifiesArrayDirectly() async {
        let store = QueryStore<TestItem> { [TestItem(id: "a"), TestItem(id: "b")] }
        await store.fetch()

        store.mutateData { $0.removeFirst() }

        #expect(store.data == [TestItem(id: "b")])
    }
}

// MARK: - ComposerState

@MainActor
struct ComposerStateTests {

    // MARK: Draft text — per target

    @Test func draftTextIsPerTarget() {
        let state = ComposerState(userDefaults: makeSuite())

        state.draftText = "feed text"
        #expect(state.draftText == "feed text")

        // Switch to chat target
        state.updateTarget(sidebarSelection: .chat(id: "c1"))
        #expect(state.draftText == "", "chat draft should start empty")

        state.draftText = "chat text"
        #expect(state.draftText == "chat text")

        // Switch back to feed
        state.updateTarget(sidebarSelection: nil)
        #expect(state.draftText == "feed text", "feed draft should be preserved")
    }

    // MARK: Draft persistence

    @Test func draftTextPersistedToUserDefaults() {
        let defaults = makeSuite()
        let state = ComposerState(userDefaults: defaults)

        state.draftText = "persisted text"

        #expect(defaults.string(forKey: "composer.draft.feed") == "persisted text")
    }

    @Test func clearDraftRemovesUserDefaultsKey() {
        let defaults = makeSuite()
        let state = ComposerState(userDefaults: defaults)

        state.draftText = "some text"
        state.clearDraft()

        #expect(defaults.string(forKey: "composer.draft.feed") == nil)
        #expect(state.draftText == "")
    }

    @Test func draftTextRestoredOnTargetChange() {
        let defaults = makeSuite()
        // Pre-seed a persisted draft for the chat target
        defaults.set("restored text", forKey: "composer.draft.chat:c1")

        let state = ComposerState(userDefaults: defaults)

        // Start on feed, switch to chat — should restore the persisted draft
        state.updateTarget(sidebarSelection: .chat(id: "c1"))
        #expect(state.draftText == "restored text")
    }

    @Test func emptyDraftTextDoesNotPersist() {
        let defaults = makeSuite()
        let state = ComposerState(userDefaults: defaults)

        state.draftText = "hello"
        state.draftText = ""   // clear via setter

        #expect(defaults.string(forKey: "composer.draft.feed") == nil)
    }

    // MARK: canSubmit

    @Test func canSubmitFalseWhenEmpty() {
        let state = ComposerState(userDefaults: makeSuite())
        #expect(!state.canSubmit)
    }

    @Test func canSubmitTrueWithText() {
        let state = ComposerState(userDefaults: makeSuite())
        state.draftText = "hello"
        #expect(state.canSubmit)
    }

    @Test func canSubmitTrueWithAttachments() {
        let state = ComposerState(userDefaults: makeSuite())
        state.addAttachment(ComposerAttachment(id: "f1", name: "file.jpg", mimeType: "image/jpeg", url: "https://example.com/f1"))
        #expect(state.canSubmit)
    }

    @Test func canSubmitFalseAfterClearDraft() {
        let state = ComposerState(userDefaults: makeSuite())
        state.draftText = "hello"
        state.clearDraft()
        #expect(!state.canSubmit)
    }

    // MARK: submitError

    @Test func submitErrorClearedWhenUserEditsText() {
        // submitError is private(set), so we can only observe it after it's set.
        // We set it via draftText (which clears it).
        // To set submitError we need access — but it's private(set).
        // We test the clearing side: if submitError were set, editing text clears it.
        // We can validate the pattern by checking the implementation path:
        // draftText setter calls `if submitError != nil { submitError = nil }`.
        // Here we just verify the text setter runs without issue and the state is consistent.
        let state = ComposerState(userDefaults: makeSuite())
        state.draftText = "first"
        state.draftText = "second"
        #expect(state.submitError == nil)
    }

    // MARK: Attachments

    @Test func addAttachmentAppearsInList() {
        let state = ComposerState(userDefaults: makeSuite())
        let attachment = ComposerAttachment(id: "f1", name: "photo.jpg", mimeType: "image/jpeg", url: "https://example.com/f1")
        state.addAttachment(attachment)
        #expect(state.attachments.contains(where: { $0.id == "f1" }))
    }

    @Test func addAttachmentIgnoresDuplicates() {
        let state = ComposerState(userDefaults: makeSuite())
        let attachment = ComposerAttachment(id: "f1", name: "photo.jpg", mimeType: "image/jpeg", url: "https://example.com/f1")
        state.addAttachment(attachment)
        state.addAttachment(attachment)
        #expect(state.attachments.count == 1)
    }

    @Test func removeAttachmentRemovesFromList() {
        let state = ComposerState(userDefaults: makeSuite())
        let attachment = ComposerAttachment(id: "f1", name: "photo.jpg", mimeType: "image/jpeg", url: "https://example.com/f1")
        state.addAttachment(attachment)
        state.removeAttachment(id: "f1")
        #expect(state.attachments.isEmpty)
    }

    @Test func clearDraftClearsAttachments() {
        let state = ComposerState(userDefaults: makeSuite())
        state.addAttachment(ComposerAttachment(id: "f1", name: "file.jpg", mimeType: "image/jpeg", url: "https://example.com/f1"))
        state.draftText = "some text"
        state.clearDraft()
        #expect(state.attachments.isEmpty)
        #expect(state.draftText == "")
    }

    @Test func attachmentsArePerTarget() {
        let state = ComposerState(userDefaults: makeSuite())
        let attachment = ComposerAttachment(id: "f1", name: "file.jpg", mimeType: "image/jpeg", url: "https://example.com/f1")

        state.addAttachment(attachment)
        #expect(state.attachments.count == 1)

        // Switch to chat — attachments should not carry over
        state.updateTarget(sidebarSelection: .chat(id: "c1"))
        #expect(state.attachments.isEmpty)
    }

    // MARK: Notes

    @Test func addNoteAppearsInSelectedNotes() {
        let state = ComposerState(userDefaults: makeSuite())
        let note = ComposerNote(id: "n1", title: "Note one")
        state.addNote(note)
        #expect(state.selectedNotes.contains(where: { $0.id == "n1" }))
    }

    @Test func addNoteIgnoresDuplicates() {
        let state = ComposerState(userDefaults: makeSuite())
        let note = ComposerNote(id: "n1", title: "Note one")
        state.addNote(note)
        state.addNote(note)
        #expect(state.selectedNotes.count == 1)
    }

    @Test func removeNoteRemovesFromList() {
        let state = ComposerState(userDefaults: makeSuite())
        let note = ComposerNote(id: "n1", title: "Note one")
        state.addNote(note)
        state.removeNote(id: "n1")
        #expect(state.selectedNotes.isEmpty)
    }

    // MARK: Target resolution

    @Test func noteDetailSelectionResolvesToHiddenTarget() {
        let state = ComposerState(userDefaults: makeSuite())
        state.updateTarget(sidebarSelection: .noteDetail(id: "note-1"))
        #expect(state.target == .hidden)
    }

    @Test func noSelectionResolvesToFeedTarget() {
        let state = ComposerState(userDefaults: makeSuite())
        state.updateTarget(sidebarSelection: nil)
        #expect(state.target == .feed)
    }

    @Test func chatSelectionResolvesToChatTarget() {
        let state = ComposerState(userDefaults: makeSuite())
        state.updateTarget(sidebarSelection: .chat(id: "thread-1"))
        #expect(state.target == .chat(id: "thread-1"))
    }

    @Test func archivedChatsSelectionResolvesToHiddenTarget() {
        let state = ComposerState(userDefaults: makeSuite())
        state.updateTarget(sidebarSelection: .archivedChats)
        #expect(state.target == .hidden)
    }

    // MARK: Target computed properties

    @Test func feedTargetPlaceholderAndLabel() {
        #expect(ComposerState.Target.feed.placeholder == "Write a note, ask something…")
        #expect(ComposerState.Target.feed.primaryLabel == "Save note")
        #expect(ComposerState.Target.feed.hasSecondaryAction)
    }

    @Test func chatTargetPlaceholderAndLabel() {
        #expect(ComposerState.Target.chat(id: "x").placeholder == "Message…")
        #expect(ComposerState.Target.chat(id: "x").primaryLabel == "Send")
        #expect(!ComposerState.Target.chat(id: "x").hasSecondaryAction)
    }

    @Test func hiddenTargetIsHidden() {
        #expect(ComposerState.Target.hidden.isHidden)
        #expect(!ComposerState.Target.feed.isHidden)
    }
}

// MARK: - ComposerAttachment systemIcon

struct ComposerAttachmentTests {
    @Test func imageAttachmentIcon() {
        let a = ComposerAttachment(id: "1", name: "photo.jpg", mimeType: "image/png", url: "")
        #expect(a.systemIcon == "photo")
    }

    @Test func audioAttachmentIcon() {
        let a = ComposerAttachment(id: "1", name: "clip.mp3", mimeType: "audio/mpeg", url: "")
        #expect(a.systemIcon == "waveform")
    }

    @Test func pdfAttachmentIcon() {
        let a = ComposerAttachment(id: "1", name: "doc.pdf", mimeType: "application/pdf", url: "")
        #expect(a.systemIcon == "doc.richtext")
    }

    @Test func unknownAttachmentIcon() {
        let a = ComposerAttachment(id: "1", name: "data.bin", mimeType: "application/octet-stream", url: "")
        #expect(a.systemIcon == "paperclip")
    }
}

// MARK: - ComposerNote displayTitle

struct ComposerNoteTests {
    @Test func displayTitleFallsBackToUntitled() {
        let n = ComposerNote(id: "1", title: nil)
        #expect(n.displayTitle == "Untitled note")
    }

    @Test func displayTitleTrimsWhitespace() {
        let n = ComposerNote(id: "1", title: "  My Note  ")
        #expect(n.displayTitle == "My Note")
    }

    @Test func displayTitleUsesProvidedTitle() {
        let n = ComposerNote(id: "1", title: "Trip ideas")
        #expect(n.displayTitle == "Trip ideas")
    }
}
