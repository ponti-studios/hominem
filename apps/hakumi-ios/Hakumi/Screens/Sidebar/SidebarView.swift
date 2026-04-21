import SwiftUI

// MARK: - SidebarView
//
// Unified sidebar list showing all inbox items (chats + notes) sorted by date.
// Replaces the separate Inbox and Notes tabs with a single NavigationSplitView
// sidebar column. Selection drives the detail column via Router.sidebarSelection.

struct SidebarView: View {
    @Environment(Router.self) private var router
    @Environment(AppStores.self) private var stores
    private var store: QueryStore<InboxItem> { stores.inbox }

    @State private var searchText = ""
    @State private var debouncedSearch = ""
    @State private var isCreatingNote = false
    @State private var createNoteError: String? = nil
    @State private var scrollPosition = ScrollPosition(idType: String.self)

    var filteredItems: [InboxItem] {
        guard !debouncedSearch.isEmpty else { return store.data }
        let q = debouncedSearch.lowercased()
        return store.data.filter { $0.title.lowercased().contains(q) }
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
                    icon: "tray",
                    title: "Nothing here yet",
                    subtitle: "Notes and chats will appear here."
                )
                .transition(.opacity)
            } else if filteredItems.isEmpty {
                EmptyStateView(
                    icon: "magnifyingglass",
                    title: "No results for \"\(debouncedSearch)\""
                )
                .transition(.opacity)
            } else {
                itemList
                    .transition(.opacity)
            }
        }
        .animation(Motion.enter, value: store.isFirstLoad)
        .navigationTitle("Hakumi")
        .searchable(text: $searchText, prompt: "Search")
        .background(Color.Hakumi.bgBase)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    Task { await createAndOpenNote() }
                } label: {
                    if isCreatingNote {
                        ProgressView().tint(Color.Hakumi.textPrimary)
                    } else {
                        Image(systemName: "square.and.pencil")
                    }
                }
                .disabled(isCreatingNote)
                .accessibilityLabel("New note")
            }
            ToolbarItem(placement: .secondaryAction) {
                Button {
                    router.showSettings = true
                } label: {
                    Label("Settings", systemImage: "gearshape")
                }
                .accessibilityLabel("Settings")
            }
        }
        .task { await store.fetch() }
        .onAppear { store.fetchIfStale() }
        .onChange(of: TopAnchorSignal.inbox.pendingRequestId) { _, _ in
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
            get: { createNoteError != nil },
            set: { if !$0 { createNoteError = nil } }
        )) {
            Button("OK") {}
        } message: {
            Text(createNoteError ?? "")
        }
    }

    // MARK: - List

    private var itemList: some View {
        @Bindable var routerBindable = router
        return List(selection: $routerBindable.sidebarSelection) {
            ForEach(filteredItems) { item in
                let itemTypeLabel: String = {
                    switch item {
                    case .chat: return "chat"
                    case .note: return "note"
                    }
                }()
                SidebarRow(item: item)
                    .tag(item.protectedRoute)
                    .accessibilityLabel("\(item.title), \(itemTypeLabel), \(item.updatedAt.relativeListString)")
                    .listRowBackground(Color.Hakumi.bgBase)
                    .listRowInsets(EdgeInsets(top: 0, leading: Spacing.lg, bottom: 0, trailing: Spacing.lg))
                    .listRowSeparator(.hidden)
                    .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                        swipeButtons(for: item)
                    }
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .scrollPosition($scrollPosition)
        .animation(Motion.spring, value: filteredItems.count)
        .refreshable { await store.fetch() }
    }

    @ViewBuilder
    private func swipeButtons(for item: InboxItem) -> some View {
        switch item {
        case .note(let note):
            Button(role: .destructive) {
                Task { await deleteNote(note) }
            } label: { Label("Delete", systemImage: "trash") }

            Button {
                Task { await archiveNote(note) }
            } label: { Label("Archive", systemImage: "archivebox") }
            .tint(.orange)

        case .chat(let chat):
            Button(role: .destructive) {
                Task { await deleteChat(chat) }
            } label: { Label("Delete", systemImage: "trash") }

            Button {
                Task { await archiveChat(chat) }
            } label: { Label("Archive", systemImage: "archivebox") }
            .tint(.orange)
        }
    }

    // MARK: - Swipe action helpers

    private func archiveNote(_ note: InboxNote) async {
        if router.sidebarSelection == .noteDetail(id: note.id) {
            router.sidebarSelection = nil
        }
        await stores.archiveNote(id: note.id)
    }

    private func deleteNote(_ note: InboxNote) async {
        if router.sidebarSelection == .noteDetail(id: note.id) {
            router.sidebarSelection = nil
        }
        await stores.deleteNote(id: note.id)
    }

    private func archiveChat(_ chat: InboxChat) async {
        if router.sidebarSelection == .chat(id: chat.id) {
            router.sidebarSelection = nil
        }
        await stores.archiveChat(id: chat.id)
    }

    private func deleteChat(_ chat: InboxChat) async {
        if router.sidebarSelection == .chat(id: chat.id) {
            router.sidebarSelection = nil
        }
        await stores.deleteChat(id: chat.id)
    }

    // MARK: - Toolbar: create note

    private func createAndOpenNote() async {
        isCreatingNote = true
        defer { isCreatingNote = false }
        do {
            let detail = try await stores.createNote()
            router.sidebarSelection = .noteDetail(id: detail.id)
        } catch {
            createNoteError = error.localizedDescription
        }
    }

    // MARK: - Scroll to top

    private func scrollToTopIfPending() {
        guard TopAnchorSignal.inbox.hasPendingReveal,
              let firstId = store.data.first?.id else { return }
        withAnimation { scrollPosition.scrollTo(id: firstId) }
        TopAnchorSignal.inbox.markHandled()
    }

}

// MARK: - SidebarRow

private struct SidebarRow: View {
    let item: InboxItem

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.sm2) {
            Image(systemName: icon)
                .font(.system(size: 13))
                .foregroundStyle(Color.Hakumi.textTertiary)
                .frame(width: 18, height: 18)
                .padding(.top, 2)

            VStack(alignment: .leading, spacing: 3) {
                Text(item.title)
                    .textStyle(AppTypography.subhead)
                    .fontWeight(.medium)
                    .foregroundStyle(Color.Hakumi.textPrimary)
                    .lineLimit(2)

                if let subtitle {
                    Text(subtitle)
                        .textStyle(AppTypography.footnote)
                        .foregroundStyle(Color.Hakumi.textSecondary)
                        .lineLimit(2)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            Text(item.updatedAt.relativeListString)
                .textStyle(AppTypography.caption1)
                .foregroundStyle(Color.Hakumi.textTertiary)
                .padding(.top, 2)
        }
        .padding(.vertical, Spacing.sm2)
    }

    private var icon: String {
        switch item {
        case .chat:  "bubble.left.and.bubble.right"
        case .note:  "note.text"
        }
    }

    private var subtitle: String? {
        switch item {
        case .chat:              nil
        case .note(let n):       n.excerpt?.isEmpty == false ? n.excerpt : nil
        }
    }
}

#Preview {
    NavigationSplitView {
        SidebarView()
    } detail: {
        Text("Select an item")
            .foregroundStyle(Color.Hakumi.textTertiary)
    }
    .environment(AppStores.shared)
    .environment(ComposerState.shared)
    .environment(Router())
}
