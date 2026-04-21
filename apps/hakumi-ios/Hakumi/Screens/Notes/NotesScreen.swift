import SwiftUI

// MARK: - NotesScreen

struct NotesScreen: View {
    @Environment(Router.self) private var router
    @Environment(AppStores.self) private var stores
    private var store: QueryStore<NoteItem> { stores.notes }
    @State private var searchText = ""
    @State private var debouncedSearch = ""
    @State private var isCreating = false
    @State private var createError: String? = nil
    @State private var scrollPosition = ScrollPosition(idType: String.self)

    var filteredNotes: [NoteItem] {
        guard !debouncedSearch.isEmpty else { return store.data }
        let q = debouncedSearch.lowercased()
        return store.data.filter {
            $0.displayTitle.lowercased().contains(q) ||
            $0.contentPreview.lowercased().contains(q)
        }
    }

    var body: some View {
        Group {
            if store.isFirstLoad {
                ScreenLoadingView()
                    .transition(.opacity)
            } else if let msg = store.errorMessage, store.isEmpty {
                ScreenErrorView(message: msg) { Task { await store.fetch() } }
                    .transition(.opacity)
            } else if store.isEmpty {
                EmptyStateView(
                    icon: "note.text",
                    title: "No notes yet",
                    subtitle: "Tap + to capture your first thought."
                )
                .transition(.opacity)
            } else if filteredNotes.isEmpty {
                EmptyStateView(
                    icon: "magnifyingglass",
                    title: "No results for \"\(debouncedSearch)\""
                )
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
        .onChange(of: searchText) { _, newValue in
            let value = newValue
            Task {
                try? await Task.sleep(for: .milliseconds(200))
                if searchText == value {
                    debouncedSearch = value
                }
            }
        }
        .alert("Couldn't create note", isPresented: Binding(
            get: { createError != nil },
            set: { if !$0 { createError = nil } }
        )) {
            Button("OK") {}
        } message: {
            Text(createError ?? "")
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
                .accessibilityLabel("\(note.displayTitle), \(note.createdAt.relativeListString)")
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
        await stores.archiveNote(id: note.id)
    }

    private func deleteNote(_ note: NoteItem) async {
        await stores.deleteNote(id: note.id)
    }

    private func scrollToTopIfPending() {
        guard TopAnchorSignal.notes.hasPendingReveal,
              let firstId = store.data.first?.id else { return }
        withAnimation { scrollPosition.scrollTo(id: firstId) }
        TopAnchorSignal.notes.markHandled()
    }

    // MARK: Create and open (toolbar button)

    private func createAndOpen() async {
        isCreating = true
        defer { isCreating = false }
        do {
            let detail = try await stores.createNote()
            router.sidebarSelection = .noteDetail(id: detail.id)
        } catch {
            createError = error.localizedDescription
        }
    }
}

#Preview {
    NavigationStack {
        NotesScreen()
    }
    .environment(AppStores.shared)
    .environment(ComposerState.shared)
    .environment(Router())
}
