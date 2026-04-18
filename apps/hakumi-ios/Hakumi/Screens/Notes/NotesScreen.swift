import SwiftUI

// MARK: - NotesScreen

struct NotesScreen: View {
    @Environment(Router.self) private var router
    @State private var notes: [NoteItem] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var searchText = ""
    @State private var isCreating = false
    @State private var lastFetchDate: Date?

    private let staleness: TimeInterval = 30

    var filteredNotes: [NoteItem] {
        guard !searchText.isEmpty else { return notes }
        let q = searchText.lowercased()
        return notes.filter {
            $0.displayTitle.lowercased().contains(q) ||
            $0.contentPreview.lowercased().contains(q)
        }
    }

    var body: some View {
        Group {
            if isLoading && notes.isEmpty {
                loadingView
            } else if let msg = errorMessage, notes.isEmpty {
                errorView(msg)
            } else if notes.isEmpty {
                emptyView
            } else if filteredNotes.isEmpty {
                noResultsView
            } else {
                notesList
            }
        }
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
            }
        }
        .background(Color.Hakumi.bgBase)
        .task { await load() }
        .onAppear { refreshIfStale() }
    }

    // MARK: Notes list

    private var notesList: some View {
        List {
            ForEach(filteredNotes) { note in
                NavigationLink(value: ProtectedRoute.noteDetail(id: note.id)) {
                    NoteRowView(note: note)
                }
                .listRowBackground(Color.Hakumi.bgBase)
                .listRowInsets(EdgeInsets(top: 0, leading: Spacing.lg, bottom: 0, trailing: Spacing.lg))
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .refreshable { await load() }
    }

    // MARK: Empty / loading / error

    private var loadingView: some View {
        VStack { Spacer(); ProgressView().tint(Color.Hakumi.textTertiary); Spacer() }
            .frame(maxWidth: .infinity)
    }

    private var emptyView: some View {
        VStack(spacing: Spacing.md) {
            Image(systemName: "note.text")
                .font(.system(size: 40))
                .foregroundStyle(Color.Hakumi.textTertiary)
            Text("No notes yet")
                .font(.system(size: 22, weight: .semibold))
                .foregroundStyle(Color.Hakumi.textPrimary)
            Text("Tap  to capture your first thought.")
                .font(.system(size: 13))
                .foregroundStyle(Color.Hakumi.textTertiary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var noResultsView: some View {
        VStack(spacing: Spacing.sm) {
            Text("No results for \"\(searchText)\"")
                .font(.system(size: 15))
                .foregroundStyle(Color.Hakumi.textSecondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func errorView(_ message: String) -> some View {
        VStack(spacing: Spacing.md) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 36))
                .foregroundStyle(Color.Hakumi.textTertiary)
            Text(message)
                .font(.system(size: 14))
                .foregroundStyle(Color.Hakumi.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, Spacing.xl)
            AppButton("Retry", variant: .ghost, size: .sm) {
                Task { await load() }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: Data

    private func load() async {
        guard !isLoading else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            notes = try await NoteService.fetchNotes()
            lastFetchDate = Date()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func refreshIfStale() {
        guard let last = lastFetchDate,
              Date().timeIntervalSince(last) > staleness else { return }
        Task { await load() }
    }

    private func createAndOpen() async {
        isCreating = true
        defer { isCreating = false }
        do {
            let note = try await NoteService.createNote()
            notes.insert(
                NoteItem(id: note.id, title: note.title, content: note.content,
                         createdAt: note.createdAt, updatedAt: note.updatedAt, hasAttachments: false),
                at: 0
            )
            router.notesPath.append(.noteDetail(id: note.id))
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

// MARK: - NoteRowView

private struct NoteRowView: View {
    let note: NoteItem

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            HStack(alignment: .firstTextBaseline) {
                Text(note.displayTitle)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Color.Hakumi.textPrimary)
                    .lineLimit(1)
                    .frame(maxWidth: .infinity, alignment: .leading)

                Text(note.createdAt.noteListDateString)
                    .font(.system(size: 12))
                    .foregroundStyle(Color.Hakumi.textTertiary)
                    .fixedSize()
            }

            if !note.contentPreview.isEmpty {
                Text(note.contentPreview)
                    .font(.system(size: 12))
                    .foregroundStyle(Color.Hakumi.textSecondary)
                    .lineLimit(2)
            }

            if note.hasAttachments {
                HStack(spacing: 4) {
                    Image(systemName: "paperclip")
                        .font(.system(size: 10))
                        .foregroundStyle(Color.Hakumi.textTertiary)
                    Text("Attachment")
                        .font(.system(size: 11))
                        .foregroundStyle(Color.Hakumi.textTertiary)
                }
            }
        }
        .padding(.vertical, Spacing.sm)
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
