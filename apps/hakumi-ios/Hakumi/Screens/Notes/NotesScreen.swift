import SwiftUI

// MARK: - NotesScreen

struct NotesScreen: View {
    @Environment(Router.self) private var router
    private var store: QueryStore<NoteItem> { AppStores.shared.notes }
    @State private var searchText = ""
    @State private var isCreating = false
    @State private var scrollPosition = ScrollPosition(idType: String.self)

    var filteredNotes: [NoteItem] {
        guard !searchText.isEmpty else { return store.data }
        let q = searchText.lowercased()
        return store.data.filter {
            $0.displayTitle.lowercased().contains(q) ||
            $0.contentPreview.lowercased().contains(q)
        }
    }

    var body: some View {
        Group {
            if store.isFirstLoad {
                loadingView
                    .transition(.opacity)
            } else if let msg = store.errorMessage, store.isEmpty {
                errorView(msg)
                    .transition(.opacity)
            } else if store.isEmpty {
                emptyView
                    .transition(.opacity)
            } else if filteredNotes.isEmpty {
                noResultsView
                    .transition(.opacity)
            } else {
                notesList
                    .transition(.opacity)
            }
        }
        .animation(Motion.enter, value: store.isFirstLoad)
        .navigationTitle("Notes")
        .navigationBarTitleDisplayMode(.inline)
        .searchable(text: $searchText, prompt: "Search notes")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    Task { await createAndOpen() }
                } label: {
                    if isCreating {
                        ProgressView().tint(Color.Hakumi.textPrimary)
                    } else {
                        Image(systemName: "square.and.pencil")
                    }
                }
                .disabled(isCreating)
                .accessibilityIdentifier("notes.newButton")
                .accessibilityLabel("New note")
            }
        }
        .background(Color.Hakumi.bgBase)
        .task { await store.fetch() }
        .onAppear { store.fetchIfStale() }
        .onChange(of: TopAnchorSignal.notes.pendingRequestId) { _, _ in
            scrollToTopIfPending()
        }
    }

    // MARK: Notes list

    private var notesList: some View {
        List {
            ForEach(filteredNotes) { note in
                let isPending = note.id.hasPrefix("tmp-")
                NavigationLink(value: ProtectedRoute.noteDetail(id: note.id)) {
                    NoteRowView(note: note, isPending: isPending)
                }
                .disabled(isPending)
                .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                    Button(role: .destructive) {
                        Task { await deleteNote(note) }
                    } label: { Label("Delete", systemImage: "trash") }

                    Button {
                        Task { await archiveNote(note) }
                    } label: { Label("Archive", systemImage: "archivebox") }
                    .tint(.orange)
                }
                .listRowBackground(Color.Hakumi.bgBase)
                .listRowInsets(EdgeInsets(top: 0, leading: Spacing.lg, bottom: 0, trailing: Spacing.lg))
                .listRowSeparator(.hidden)
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .scrollPosition($scrollPosition)
        .animation(Motion.spring, value: filteredNotes.count)
        .refreshable { await store.fetch() }
    }

    // MARK: Swipe action helpers

    private func archiveNote(_ note: NoteItem) async {
        AppStores.shared.notes.mutateData { $0.removeAll { $0.id == note.id } }
        AppStores.shared.inbox.mutateData { $0.removeAll { $0.id == "note-\(note.id)" } }
        do {
            try await NoteService.archiveNote(id: note.id)
        } catch {
            AppStores.shared.notes.mutateData { $0.insert(note, at: 0) }
        }
    }

    private func deleteNote(_ note: NoteItem) async {
        AppStores.shared.notes.mutateData { $0.removeAll { $0.id == note.id } }
        AppStores.shared.inbox.mutateData { $0.removeAll { $0.id == "note-\(note.id)" } }
        do {
            try await NoteService.deleteNote(id: note.id)
        } catch {
            AppStores.shared.notes.mutateData { $0.insert(note, at: 0) }
        }
    }

    private func scrollToTopIfPending() {
        guard TopAnchorSignal.notes.hasPendingReveal,
              let firstId = store.data.first?.id else { return }
        withAnimation { scrollPosition.scrollTo(id: firstId) }
        TopAnchorSignal.notes.markHandled()
    }

    // MARK: Empty / loading / error

    private var loadingView: some View {
        VStack { Spacer(); ProgressView().tint(Color.Hakumi.textTertiary); Spacer() }
            .frame(maxWidth: .infinity)
    }

    private var emptyView: some View {
        VStack(spacing: Spacing.md) {
            Image(systemName: "note.text")
                .font(.system(size: 38))
                .foregroundStyle(Color.Hakumi.textTertiary)
            VStack(spacing: Spacing.xs) {
                Text("No notes yet")
                    .textStyle(AppTypography.headline)
                    .foregroundStyle(Color.Hakumi.textPrimary)
                Text("Tap  to capture your first thought.")
                    .textStyle(AppTypography.footnote)
                    .foregroundStyle(Color.Hakumi.textTertiary)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var noResultsView: some View {
        VStack(spacing: Spacing.sm) {
            Text("No results for \"\(searchText)\"")
                .textStyle(AppTypography.subhead)
                .foregroundStyle(Color.Hakumi.textSecondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func errorView(_ message: String) -> some View {
        VStack(spacing: Spacing.md) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 34))
                .foregroundStyle(Color.Hakumi.textTertiary)
            Text(message)
                .textStyle(AppTypography.footnote)
                .foregroundStyle(Color.Hakumi.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, Spacing.xl)
            AppButton("Retry", variant: .ghost, size: .sm) {
                Task { await store.fetch() }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: Create and open (toolbar button)

    private func createAndOpen() async {
        isCreating = true
        defer { isCreating = false }
        do {
            let detail = try await NoteService.createNote()
            let item = NoteItem(
                id: detail.id,
                title: detail.title,
                content: detail.content,
                createdAt: detail.createdAt,
                updatedAt: detail.updatedAt,
                hasAttachments: false
            )
            store.mutateData { $0.insert(item, at: 0) }
            router.sidebarSelection = .noteDetail(id: detail.id)
        } catch {
            // Non-fatal — toolbar button stays enabled for retry
        }
    }
}

// MARK: - NoteRowView

private struct NoteRowView: View {
    let note: NoteItem
    let isPending: Bool

    var body: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 4) {
                HStack(alignment: .firstTextBaseline, spacing: Spacing.sm) {
                    Text(note.displayTitle)
                        .textStyle(AppTypography.subhead)
                        .fontWeight(.semibold)
                        .foregroundStyle(Color.Hakumi.textPrimary)
                        .lineLimit(1)
                        .frame(maxWidth: .infinity, alignment: .leading)

                    if !isPending {
                        Text(note.createdAt.noteListDateString)
                            .textStyle(AppTypography.caption1)
                            .foregroundStyle(Color.Hakumi.textTertiary)
                            .fixedSize()
                    }
                }

                if !note.contentPreview.isEmpty {
                    Text(note.contentPreview)
                        .textStyle(AppTypography.caption1)
                        .foregroundStyle(Color.Hakumi.textSecondary)
                        .lineLimit(2)
                }

                if note.hasAttachments {
                    HStack(spacing: Spacing.xs) {
                        Image(systemName: "paperclip")
                            .font(.system(size: 10))
                            .foregroundStyle(Color.Hakumi.textTertiary)
                        Text("Attachment")
                            .textStyle(AppTypography.caption2)
                            .foregroundStyle(Color.Hakumi.textTertiary)
                    }
                }
            }

            if isPending {
                ProgressView()
                    .scaleEffect(0.7)
                    .tint(Color.Hakumi.textTertiary)
                    .padding(.top, 2)
            }
        }
        .padding(.vertical, Spacing.sm2)
        .opacity(isPending ? 0.6 : 1)
    }
}

// MARK: - Date formatting

private extension Date {
    var noteListDateString: String {
        let now = Date()
        let cal = Calendar.current
        let diffDays = cal.dateComponents([.day],
            from: cal.startOfDay(for: self),
            to: cal.startOfDay(for: now)).day ?? 0

        if diffDays == 0 {
            let f = DateFormatter()
            f.dateFormat = "h:mm a"
            return f.string(from: self)
        }
        if diffDays == 1 { return "Yesterday" }
        if diffDays < 7 {
            let f = DateFormatter()
            f.dateFormat = "EEE"
            return f.string(from: self)
        }
        let f = DateFormatter()
        f.dateFormat = diffDays < 365 ? "MMM d" : "MMM d, yyyy"
        return f.string(from: self)
    }
}

#Preview {
    NavigationStack {
        NotesScreen()
            .environment(Router())
    }
}
