import Foundation
import Observation

// MARK: - SaveState

public enum NoteDetailSaveState: Equatable, Sendable {
    case idle
    case saving
    case saved
    case failed
}

// MARK: - NoteDetailViewModel

/// Focused, testable model for the note editor's auto-save and save-state
/// behaviour.
///
/// Owns the edited field values, a debounce task, and the current save state.
/// Views that present a note editor should hold one instance of this model and
/// call `scheduleAutoSave()` whenever the user changes a field, then
/// `flushPendingSave()` on disappear.
///
/// The `debounceDelay` parameter is injectable so unit tests can use a short
/// duration without real-time waiting.
@Observable
@MainActor
public final class NoteDetailViewModel {

    // MARK: - Published state

    public var editedTitle: String
    public var editedContent: String
    public private(set) var saveState: NoteDetailSaveState = .idle

    // MARK: - Private state

    private let noteId: String
    private let notesStore: NotesStore
    private let debounceDelay: Duration
    private var saveTask: Task<Void, Never>?

    // MARK: - Init

    public init(
        note: Note,
        notesStore: NotesStore,
        debounceDelay: Duration = .seconds(1.5)
    ) {
        self.noteId = note.id
        self.editedTitle = note.title ?? ""
        self.editedContent = note.content
        self.notesStore = notesStore
        self.debounceDelay = debounceDelay
    }

    // MARK: - Auto-save

    /// Cancel any pending debounce and schedule a new one.
    /// Sets `saveState` to `.saving` immediately so the UI can show a spinner.
    public func scheduleAutoSave() {
        saveTask?.cancel()
        saveState = .saving
        saveTask = Task { [weak self] in
            guard let self else { return }
            try? await Task.sleep(for: debounceDelay)
            guard !Task.isCancelled else { return }
            await performSave()
        }
    }

    /// Cancel any pending debounce timer and immediately flush the pending edit
    /// to the server. Call this from `.onDisappear` to avoid losing edits.
    public func flushPendingSave() async {
        saveTask?.cancel()
        saveTask = nil
        guard saveState == .saving else { return }
        await performSave()
    }

    // MARK: - Save

    /// Submit the current edited fields to `NotesStore.updateNote`.
    /// Updates `saveState` to `.saved` on success and `.failed` on error.
    @discardableResult
    public func performSave() async -> Bool {
        let titleValue = editedTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        do {
            _ = try await notesStore.updateNote(
                id: noteId,
                input: NotesUpdateInput(
                    title: titleValue.isEmpty ? nil : titleValue,
                    clearTitle: titleValue.isEmpty,
                    content: editedContent
                )
            )
            saveState = .saved
            // Briefly show the "Saved" indicator, then return to idle
            try? await Task.sleep(for: .seconds(2))
            if saveState == .saved { saveState = .idle }
            return true
        } catch {
            saveState = .failed
            return false
        }
    }
}
