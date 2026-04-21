import SwiftUI

@Observable
@MainActor
final class NoteDetailViewModel {

    enum SaveState {
        case idle, saving, saved, failed(String)
    }

    private(set) var note: NoteDetail? = nil
    private(set) var files: [NoteFile] = []
    private(set) var isLoading = true
    private(set) var saveState: SaveState = .idle

    private var autosaveTask: Task<Void, Never>? = nil
    private let autosaveDelay: Duration = .milliseconds(600)

    // MARK: Load

    func load(id: String) async {
        isLoading = true
        defer { isLoading = false }
        do {
            let loaded = try await NoteService.fetchNote(id: id)
            note = loaded
            files = loaded.files
        } catch {
            note = nil
        }
    }

    // MARK: Autosave

    func scheduleAutosave(id: String, title: String, content: String) {
        guard note != nil, !isLoading else { return }
        autosaveTask?.cancel()
        autosaveTask = Task { [weak self] in
            guard let self else { return }
            do {
                try await Task.sleep(for: autosaveDelay)
            } catch {
                return  // cancelled — newer keystroke pending
            }
            await save(id: id, title: title, content: content, fileIds: files.map(\.id))
        }
    }

    func cancelAutosave() {
        autosaveTask?.cancel()
    }

    // MARK: Save

    func save(id: String, title: String, content: String, fileIds: [String]) async {
        guard note != nil else { return }
        saveState = .saving
        do {
            let trimmedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
            let updated = try await NoteService.saveNote(
                id: id,
                title: trimmedTitle.isEmpty ? nil : trimmedTitle,
                content: content,
                fileIds: fileIds
            )
            note = updated
            files = updated.files
            withAnimation { saveState = .saved }
            try? await Task.sleep(for: .seconds(1.5))
            withAnimation { if case .saved = saveState { saveState = .idle } }
            TopAnchorSignal.inbox.request()
        } catch {
            withAnimation { saveState = .failed(error.localizedDescription) }
        }
    }

    // MARK: Detach file

    func detach(noteId: String, fileId: String, title: String, content: String) async {
        files = files.filter { $0.id != fileId }
        autosaveTask?.cancel()
        await save(id: noteId, title: title, content: content, fileIds: files.map(\.id))
    }
}
