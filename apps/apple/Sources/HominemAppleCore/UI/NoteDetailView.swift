import SwiftUI

/// Full-screen note editor backed by `NoteDetailViewModel` for testable
/// auto-save behaviour with a 1.5 s debounce.
///
/// Mirrors `apps/mobile/app/(protected)/(tabs)/notes/[id].tsx`.
public struct NoteDetailView: View {
    let note: Note

    @State private var editorModel: NoteDetailViewModel

    public init(note: Note, notesStore: NotesStore) {
        self.note = note
        self._editorModel = State(initialValue: NoteDetailViewModel(note: note, notesStore: notesStore))
    }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: AppleTheme.md) {
                // Title
                TextField("Untitled", text: $editorModel.editedTitle, axis: .vertical)
                    .font(.system(size: 28, weight: .semibold))
                    .foregroundStyle(AppleTheme.foreground)
                    .onChange(of: editorModel.editedTitle) { _, _ in
                        editorModel.scheduleAutoSave()
                    }

                Divider()

                // Content
                TextEditor(text: $editorModel.editedContent)
                    .font(AppleTheme.bodyFont)
                    .foregroundStyle(AppleTheme.foreground)
                    .frame(minHeight: 300)
                    .scrollDisabled(true)
                    .onChange(of: editorModel.editedContent) { _, _ in
                        editorModel.scheduleAutoSave()
                    }

                // Files
                if note.files.isEmpty == false {
                    filesSection
                }
            }
            .padding(AppleTheme.md)
        }
        .navigationTitle(editorModel.editedTitle.isEmpty ? "Untitled" : editorModel.editedTitle)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                saveIndicator
            }
        }
        .onDisappear {
            // Flush any pending debounced save immediately on disappear
            Task { await editorModel.flushPendingSave() }
        }
    }

    // MARK: - Save indicator

    @ViewBuilder
    private var saveIndicator: some View {
        switch editorModel.saveState {
        case .idle:
            EmptyView()
        case .saving:
            HStack(spacing: AppleTheme.xs) {
                ProgressView().scaleEffect(0.75)
                Text("Saving")
                    .font(AppleTheme.captionFont)
                    .foregroundStyle(AppleTheme.tertiaryText)
            }
        case .saved:
            Label("Saved", systemImage: "checkmark")
                .font(AppleTheme.captionFont)
                .foregroundStyle(AppleTheme.tertiaryText)
                .transition(.opacity)
        case .failed:
            Label("Save failed", systemImage: "exclamationmark.triangle")
                .font(AppleTheme.captionFont)
                .foregroundStyle(AppleTheme.destructive)
        }
    }

    // MARK: - Files

    private var filesSection: some View {
        VStack(alignment: .leading, spacing: AppleTheme.sm) {
            Text("FILES")
                .font(AppleTheme.captionFont)
                .foregroundStyle(AppleTheme.tertiaryText)
                .padding(.top, AppleTheme.sm)

            ForEach(note.files) { file in
                FileAttachmentRow(file: file)
            }
        }
    }
}

// MARK: - FileAttachmentRow

private struct FileAttachmentRow: View {
    let file: NoteFile

    private var isImage: Bool { file.mimetype.hasPrefix("image/") }

    var body: some View {
        HStack(spacing: AppleTheme.sm) {
            thumbnail

            VStack(alignment: .leading, spacing: 2) {
                Text(file.originalName)
                    .font(AppleTheme.captionFont)
                    .foregroundStyle(AppleTheme.foreground)
                    .lineLimit(1)

                Text(ByteCountFormatter.string(
                    fromByteCount: Int64(file.size),
                    countStyle: .file
                ))
                .font(AppleTheme.monoCaptionFont)
                .foregroundStyle(AppleTheme.tertiaryText)
            }

            Spacer()

            if let fileURL = URL(string: file.url) {
                Link(destination: fileURL) {
                    Image(systemName: "arrow.up.right.square")
                        .foregroundStyle(AppleTheme.accent)
                }
            }
        }
        .padding(AppleTheme.sm12)
        .background(AppleTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: AppleTheme.cardRadius, style: .continuous))
    }

    @ViewBuilder
    private var thumbnail: some View {
        if isImage, let url = URL(string: file.url) {
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let img):
                    img.resizable().scaledToFill()
                case .failure:
                    Image(systemName: "photo").foregroundStyle(AppleTheme.tertiaryText)
                default:
                    ProgressView()
                }
            }
            .frame(width: 44, height: 44)
            .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
        } else {
            Image(systemName: fileIcon)
                .font(.title3)
                .foregroundStyle(AppleTheme.tertiaryText)
                .frame(width: 44, height: 44)
        }
    }

    private var fileIcon: String {
        if file.mimetype.hasPrefix("audio/") { return "waveform" }
        if file.mimetype == "application/pdf" { return "doc.richtext" }
        return "doc"
    }
}
