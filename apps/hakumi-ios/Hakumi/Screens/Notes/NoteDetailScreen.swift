import SwiftUI

// MARK: - SaveState

private enum SaveState {
    case idle, saving, saved, failed(String)
}

// MARK: - NoteDetailScreen

struct NoteDetailScreen: View {
    let id: String

    @Environment(Router.self) private var router
    @State private var note: NoteDetail?
    @State private var title: String = ""
    @State private var content: String = ""
    @State private var files: [NoteFile] = []
    @State private var isLoading = true
    @State private var hasLoaded = false
    @State private var saveState: SaveState = .idle
    @State private var autosaveTask: Task<Void, Never>?

    // Debounce interval matching Expo's useNoteEditor (600 ms)
    private let autosaveDelay: Duration = .milliseconds(600)

    var body: some View {
        Group {
            if isLoading {
                loadingView
            } else if note != nil {
                editorView
            } else {
                errorView
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .background(Color.Hakumi.bgBase)
        .toolbar { toolbarContent }
        .task { await load() }
        .onDisappear { autosaveTask?.cancel() }
    }

    // MARK: Editor

    private var editorView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                // Title
                TextField("Title", text: $title, axis: .vertical)
                    .font(.system(size: 28, weight: .bold))
                    .tracking(-0.6)
                    .foregroundStyle(Color.Hakumi.textPrimary)
                    .tint(Color.Hakumi.accent)
                    .onChange(of: title) { scheduleAutosave() }
                    .padding(.bottom, Spacing.md)
                    .accessibilityIdentifier("note.titleField")

                Divider()
                    .background(Color.Hakumi.borderSubtle)
                    .padding(.bottom, Spacing.md)

                // Content
                TextEditor(text: $content)
                    .font(.system(size: 16))
                    .tracking(-0.1)
                    .lineSpacing(4)
                    .foregroundStyle(Color.Hakumi.textPrimary)
                    .tint(Color.Hakumi.accent)
                    .scrollDisabled(true)
                    .frame(minHeight: 240, alignment: .topLeading)
                    .onChange(of: content) { scheduleAutosave() }
                    .accessibilityIdentifier("note.contentEditor")

                // Attachments
                if !files.isEmpty {
                    attachmentsSection
                }
            }
            .padding(.horizontal, Spacing.lg)
            .padding(.top, Spacing.sm)
            .padding(.bottom, 240)
        }
    }

    // MARK: Attachments

    private var attachmentsSection: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text("ATTACHMENTS")
                .font(.system(size: 12, weight: .medium))
                .tracking(0.4)
                .foregroundStyle(Color.Hakumi.textTertiary)
                .padding(.top, Spacing.xl)

            ForEach(files) { file in
                HStack(spacing: Spacing.sm) {
                    Image(systemName: "paperclip")
                        .font(.system(size: 13))
                        .foregroundStyle(Color.Hakumi.textSecondary)
                        .frame(width: 16)

                    Text(file.originalName)
                        .font(.system(size: 13))
                        .foregroundStyle(Color.Hakumi.textSecondary)
                        .lineLimit(1)
                        .frame(maxWidth: .infinity, alignment: .leading)

                    Button {
                        Task { await detach(fileId: file.id) }
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(Color.Hakumi.textTertiary)
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, Spacing.md)
                .padding(.vertical, Spacing.sm)
                .background(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .fill(Color.Hakumi.bgElevated)
                )
            }
        }
    }

    // MARK: Loading / Error

    private var loadingView: some View {
        VStack { Spacer(); ProgressView().tint(Color.Hakumi.textTertiary); Spacer() }
            .frame(maxWidth: .infinity)
    }

    private var errorView: some View {
        VStack(spacing: Spacing.md) {
            Text("Note not found.")
                .font(.system(size: 14))
                .foregroundStyle(Color.Hakumi.textSecondary)
            AppButton("Retry", variant: .ghost, size: .sm) {
                Task { await load() }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: Toolbar

    @ToolbarContentBuilder
    private var toolbarContent: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            HStack(spacing: Spacing.md) {
                saveIndicator

                // Chat handoff
                Button {
                    autosaveTask?.cancel()
                    router.selectedTab = .inbox
                    router.protectedPath = [.chat(id: id)]
                } label: {
                    Image(systemName: "bubble.left")
                }
                .disabled(note == nil)
            }
        }
    }

    @ViewBuilder
    private var saveIndicator: some View {
        switch saveState {
        case .saving:
            ProgressView()
                .scaleEffect(0.75)
                .tint(Color.Hakumi.textTertiary)
        case .saved:
            Image(systemName: "checkmark")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Color.Hakumi.textTertiary)
                .transition(.opacity)
        case .failed:
            Image(systemName: "exclamationmark.circle")
                .font(.system(size: 14))
                .foregroundStyle(.red.opacity(0.7))
        case .idle:
            EmptyView()
        }
    }

    // MARK: Data

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            let loaded = try await NoteService.fetchNote(id: id)
            note = loaded
            title = loaded.title ?? ""
            content = loaded.content
            files = loaded.files
            hasLoaded = true
        } catch {
            note = nil
        }
    }

    // MARK: Autosave

    /// Schedules a debounced save. Cancels any in-flight pending save first.
    private func scheduleAutosave() {
        guard hasLoaded, !isLoading else { return }
        autosaveTask?.cancel()
        autosaveTask = Task {
            do {
                try await Task.sleep(for: autosaveDelay)
            } catch {
                return  // cancelled — a newer keystroke is pending
            }
            await save(fileIds: files.map(\.id))
        }
    }

    private func save(fileIds: [String]) async {
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
            // Fade the checkmark out after 1.5 s
            try? await Task.sleep(for: .seconds(1.5))
            withAnimation { if case .saved = saveState { saveState = .idle } }
            TopAnchorSignal.inbox.request()
        } catch {
            withAnimation { saveState = .failed(error.localizedDescription) }
        }
    }

    // MARK: File detachment

    private func detach(fileId: String) async {
        let newFileIds = files.filter { $0.id != fileId }.map(\.id)
        // Optimistic update
        files = files.filter { $0.id != fileId }
        autosaveTask?.cancel()
        await save(fileIds: newFileIds)
    }
}

#Preview {
    NavigationStack {
        NoteDetailScreen(id: "preview-id")
            .environment(Router())
    }
}
