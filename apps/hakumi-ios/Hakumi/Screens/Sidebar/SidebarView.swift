import SwiftUI

// MARK: - SidebarView
//
// Unified sidebar list showing all inbox items (chats + notes) sorted by date.
// Replaces the separate Inbox and Notes tabs with a single NavigationSplitView
// sidebar column. Selection drives the detail column via Router.sidebarSelection.

struct SidebarView: View {
    @Environment(Router.self) private var router
    private var store: QueryStore<InboxItem> { AppStores.shared.inbox }

    @State private var searchText = ""
    @State private var isCreatingNote = false
    @State private var scrollPosition = ScrollPosition(idType: String.self)

    var filteredItems: [InboxItem] {
        guard !searchText.isEmpty else { return store.data }
        let q = searchText.lowercased()
        return store.data.filter { $0.title.lowercased().contains(q) }
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
            } else if filteredItems.isEmpty {
                noResultsView
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
    }

    // MARK: - List

    private var itemList: some View {
        @Bindable var routerBindable = router
        return List(selection: $routerBindable.sidebarSelection) {
            ForEach(filteredItems) { item in
                SidebarRow(item: item)
                    .tag(item.protectedRoute)
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
        let itemId = "note-\(note.id)"
        if router.sidebarSelection == .noteDetail(id: note.id) {
            router.sidebarSelection = nil
        }
        AppStores.shared.inbox.mutateData { $0.removeAll { $0.id == itemId } }
        AppStores.shared.notes.mutateData { $0.removeAll { $0.id == note.id } }
        do {
            try await NoteService.archiveNote(id: note.id)
        } catch {
            AppStores.shared.inbox.mutateData { $0.insert(.note(note), at: 0) }
        }
    }

    private func deleteNote(_ note: InboxNote) async {
        let itemId = "note-\(note.id)"
        if router.sidebarSelection == .noteDetail(id: note.id) {
            router.sidebarSelection = nil
        }
        AppStores.shared.inbox.mutateData { $0.removeAll { $0.id == itemId } }
        AppStores.shared.notes.mutateData { $0.removeAll { $0.id == note.id } }
        do {
            try await NoteService.deleteNote(id: note.id)
        } catch {
            AppStores.shared.inbox.mutateData { $0.insert(.note(note), at: 0) }
        }
    }

    private func archiveChat(_ chat: InboxChat) async {
        if router.sidebarSelection == .chat(id: chat.id) {
            router.sidebarSelection = nil
        }
        AppStores.shared.inbox.mutateData { $0.removeAll { $0.id == "chat-\(chat.id)" } }
        do {
            try await ChatService.archiveChat(id: chat.id)
        } catch {
            AppStores.shared.inbox.mutateData { $0.insert(.chat(chat), at: 0) }
        }
    }

    private func deleteChat(_ chat: InboxChat) async {
        if router.sidebarSelection == .chat(id: chat.id) {
            router.sidebarSelection = nil
        }
        AppStores.shared.inbox.mutateData { $0.removeAll { $0.id == "chat-\(chat.id)" } }
        do {
            try await ChatService.deleteChat(id: chat.id)
        } catch {
            AppStores.shared.inbox.mutateData { $0.insert(.chat(chat), at: 0) }
        }
    }

    // MARK: - Toolbar: create note

    private func createAndOpenNote() async {
        isCreatingNote = true
        defer { isCreatingNote = false }
        do {
            let detail = try await NoteService.createNote()
            let inboxNote = InboxNote(
                id: detail.id,
                title: detail.title ?? "Untitled",
                excerpt: nil,
                updatedAt: detail.updatedAt
            )
            AppStores.shared.inbox.mutateData { $0.insert(.note(inboxNote), at: 0) }
            router.sidebarSelection = .noteDetail(id: detail.id)
        } catch {
            // Non-fatal — button stays enabled for retry
        }
    }

    // MARK: - Scroll to top

    private func scrollToTopIfPending() {
        guard TopAnchorSignal.inbox.hasPendingReveal,
              let firstId = store.data.first?.id else { return }
        withAnimation { scrollPosition.scrollTo(id: firstId) }
        TopAnchorSignal.inbox.markHandled()
    }

    // MARK: - Empty / loading / error states

    private var loadingView: some View {
        VStack { Spacer(); ProgressView().tint(Color.Hakumi.textTertiary); Spacer() }
            .frame(maxWidth: .infinity)
    }

    private var emptyView: some View {
        VStack(spacing: Spacing.md) {
            Image(systemName: "tray")
                .font(.system(size: 38))
                .foregroundStyle(Color.Hakumi.textTertiary)
            VStack(spacing: Spacing.xs) {
                Text("Nothing here yet")
                    .textStyle(AppTypography.headline)
                    .foregroundStyle(Color.Hakumi.textPrimary)
                Text("Notes and chats will appear here.")
                    .textStyle(AppTypography.footnote)
                    .foregroundStyle(Color.Hakumi.textTertiary)
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

            Text(item.updatedAt.sidebarDateString)
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

// MARK: - Date formatting

private extension Date {
    var sidebarDateString: String {
        let now = Date()
        let diff = now.timeIntervalSince(self)
        if diff < 60       { return "now" }
        if diff < 3600     { return "\(Int(diff / 60))m" }
        if diff < 86400    { return "\(Int(diff / 3600))h" }
        if diff < 7 * 86400 { return "\(Int(diff / 86400))d" }
        let f = DateFormatter()
        f.dateFormat = Calendar.current.isDate(self, equalTo: now, toGranularity: .year)
            ? "MMM d" : "MMM d, yyyy"
        return f.string(from: self)
    }
}

#Preview {
    NavigationSplitView {
        SidebarView()
    } detail: {
        Text("Select an item")
            .foregroundStyle(Color.Hakumi.textTertiary)
    }
    .environment(Router())
}
