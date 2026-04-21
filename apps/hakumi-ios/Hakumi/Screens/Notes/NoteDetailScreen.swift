import SwiftUI

struct NoteDetailScreen: View {
    let id: String

    @Environment(Router.self) private var router
    @State private var vm = NoteDetailViewModel()
    @State private var title: String = ""
    @State private var content: String = ""

    var body: some View {
        Group {
            if vm.isLoading {
                ScreenLoadingView()
            } else if vm.note != nil {
                editorView
            } else {
                ScreenErrorView(message: "Note not found.") {
                    Task { await loadNote() }
                }
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .background(Color.Hakumi.bgBase)
        .toolbar { toolbarContent }
        .task { await loadNote() }
        .onDisappear { vm.cancelAutosave() }
    }

    // MARK: Editor

    private var editorView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                TextField("Title", text: $title, axis: .vertical)
                    .font(.system(size: 28, weight: .bold))
                    .tracking(-0.6)
                    .foregroundStyle(Color.Hakumi.textPrimary)
                    .tint(Color.Hakumi.accent)
                    .onChange(of: title) { vm.scheduleAutosave(id: id, title: title, content: content) }
                    .padding(.bottom, Spacing.md)
                    .accessibilityIdentifier("note.titleField")

                Divider()
                    .background(Color.Hakumi.borderSubtle)
                    .padding(.bottom, Spacing.md)

                TextEditor(text: $content)
                    .font(.system(size: 16))
                    .tracking(-0.1)
                    .lineSpacing(4)
                    .foregroundStyle(Color.Hakumi.textPrimary)
                    .tint(Color.Hakumi.accent)
                    .scrollDisabled(true)
                    .frame(minHeight: 240, alignment: .topLeading)
                    .onChange(of: content) { vm.scheduleAutosave(id: id, title: title, content: content) }
                    .accessibilityIdentifier("note.contentEditor")

                if !vm.files.isEmpty {
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

            ForEach(vm.files) { file in
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
                        Task { await vm.detach(noteId: id, fileId: file.id, title: title, content: content) }
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

    // MARK: Toolbar

    @ToolbarContentBuilder
    private var toolbarContent: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            HStack(spacing: Spacing.md) {
                saveIndicator

                // TODO: Requires API to return an associated chatId for the note.
                // The note `id` is not a chat ID — routing to .chat(id: noteId) opens a broken screen.
                Button {
                    vm.cancelAutosave()
                    router.sidebarSelection = .chat(id: id)
                } label: {
                    Image(systemName: "bubble.left")
                }
                .opacity(0)
                .disabled(true)
            }
        }
    }

    @ViewBuilder
    private var saveIndicator: some View {
        switch vm.saveState {
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
                .foregroundStyle(Color.Hakumi.destructive)
        case .idle:
            EmptyView()
        }
    }

    // MARK: Helpers

    private func loadNote() async {
        await vm.load(id: id)
        if let note = vm.note {
            title = note.title ?? ""
            content = note.content
        }
    }
}

#Preview {
    NavigationStack {
        NoteDetailScreen(id: "preview-id")
            .environment(Router())
    }
}
