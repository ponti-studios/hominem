import SwiftUI

// MARK: - InboxScreen

struct InboxScreen: View {
    private var store: QueryStore<InboxItem> { AppStores.shared.inbox }
    @State private var scrollPosition = ScrollPosition(idType: String.self)

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
            } else {
                feedList
                    .transition(.opacity)
            }
        }
        .animation(Motion.enter, value: store.isFirstLoad)
        .navigationTitle("Inbox")
        .navigationBarTitleDisplayMode(.inline)
        .background(Color.Hakumi.bgBase)
        .task { await store.fetch() }
        .onAppear { store.fetchIfStale() }
        .onChange(of: TopAnchorSignal.inbox.pendingRequestId) { _, _ in
            scrollToTopIfPending()
        }
    }

    // MARK: Feed list

    private var feedList: some View {
        List {
            ForEach(store.data) { item in
                inboxRow(item)
                    .listRowBackground(Color.Hakumi.bgBase)
                    .listRowInsets(EdgeInsets(top: 0, leading: Spacing.lg, bottom: 0, trailing: Spacing.lg))
                    .listRowSeparator(.hidden)
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .scrollPosition($scrollPosition)
        .animation(Motion.spring, value: store.data.count)
        .refreshable { await store.fetch() }
    }

    @ViewBuilder
    private func inboxRow(_ item: InboxItem) -> some View {
        switch item {
        case .chat(let chat):
            NavigationLink(value: ProtectedRoute.chat(id: chat.id)) {
                InboxRowView(
                    icon: "bubble.left.and.bubble.right",
                    title: chat.title,
                    subtitle: nil,
                    date: chat.activityAt,
                    isPending: false
                )
            }
            .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                Button(role: .destructive) {
                    Task { await deleteChat(chat) }
                } label: { Label("Delete", systemImage: "trash") }

                Button {
                    Task { await archiveChat(chat) }
                } label: { Label("Archive", systemImage: "archivebox") }
                .tint(.orange)
            }
        case .note(let note):
            let isPending = note.id.hasPrefix("tmp-")
            NavigationLink(value: ProtectedRoute.noteDetail(id: note.id)) {
                InboxRowView(
                    icon: "note.text",
                    title: note.title,
                    subtitle: note.excerpt,
                    date: note.updatedAt,
                    isPending: isPending
                )
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
        }
    }

    // MARK: Swipe action helpers

    private func archiveNote(_ note: InboxNote) async {
        AppStores.shared.inbox.mutateData { $0.removeAll { $0.id == "note-\(note.id)" } }
        AppStores.shared.notes.mutateData { $0.removeAll { $0.id == note.id } }
        do {
            try await NoteService.archiveNote(id: note.id)
        } catch {
            AppStores.shared.inbox.mutateData { $0.insert(.note(note), at: 0) }
        }
    }

    private func deleteNote(_ note: InboxNote) async {
        AppStores.shared.inbox.mutateData { $0.removeAll { $0.id == "note-\(note.id)" } }
        AppStores.shared.notes.mutateData { $0.removeAll { $0.id == note.id } }
        do {
            try await NoteService.deleteNote(id: note.id)
        } catch {
            AppStores.shared.inbox.mutateData { $0.insert(.note(note), at: 0) }
        }
    }

    private func archiveChat(_ chat: InboxChat) async {
        AppStores.shared.inbox.mutateData { $0.removeAll { $0.id == "chat-\(chat.id)" } }
        do {
            try await ChatService.archiveChat(id: chat.id)
        } catch {
            AppStores.shared.inbox.mutateData { $0.insert(.chat(chat), at: 0) }
        }
    }

    private func deleteChat(_ chat: InboxChat) async {
        AppStores.shared.inbox.mutateData { $0.removeAll { $0.id == "chat-\(chat.id)" } }
        do {
            try await ChatService.deleteChat(id: chat.id)
        } catch {
            AppStores.shared.inbox.mutateData { $0.insert(.chat(chat), at: 0) }
        }
    }

    // MARK: Empty / loading / error states

    private var loadingView: some View {
        VStack {
            Spacer()
            ProgressView().tint(Color.Hakumi.textTertiary)
            Spacer()
        }
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
                Text("Chats and notes will appear here.")
                    .textStyle(AppTypography.footnote)
                    .foregroundStyle(Color.Hakumi.textTertiary)
            }
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

    // MARK: Scroll to top after optimistic insert

    private func scrollToTopIfPending() {
        guard TopAnchorSignal.inbox.hasPendingReveal,
              let firstId = store.data.first?.id else { return }
        withAnimation { scrollPosition.scrollTo(id: firstId) }
        TopAnchorSignal.inbox.markHandled()
    }
}

// MARK: - InboxRowView

private struct InboxRowView: View {
    let icon: String
    let title: String
    let subtitle: String?
    let date: Date
    let isPending: Bool

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.sm2) {
            Image(systemName: icon)
                .font(.system(size: 13))
                .foregroundStyle(Color.Hakumi.textTertiary)
                .frame(width: 18, height: 18)
                .padding(.top, 2)

            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .textStyle(AppTypography.subhead)
                    .fontWeight(.medium)
                    .foregroundStyle(Color.Hakumi.textPrimary)
                    .lineLimit(2)

                if let subtitle, !subtitle.isEmpty {
                    Text(subtitle)
                        .textStyle(AppTypography.footnote)
                        .foregroundStyle(Color.Hakumi.textSecondary)
                        .lineLimit(2)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            if isPending {
                ProgressView()
                    .scaleEffect(0.7)
                    .tint(Color.Hakumi.textTertiary)
                    .padding(.top, 2)
            } else {
                Text(date.relativeString)
                    .textStyle(AppTypography.caption1)
                    .foregroundStyle(Color.Hakumi.textTertiary)
                    .padding(.top, 2)
            }
        }
        .padding(.vertical, Spacing.sm2)
        .opacity(isPending ? 0.6 : 1)
    }
}

// MARK: - Date formatting

private extension Date {
    var relativeString: String {
        let now = Date()
        let diff = now.timeIntervalSince(self)

        if diff < 60 { return "now" }
        if diff < 3600 {
            let mins = Int(diff / 60)
            return "\(mins)m"
        }
        if diff < 86400 {
            let hours = Int(diff / 3600)
            return "\(hours)h"
        }
        if diff < 7 * 86400 {
            let days = Int(diff / 86400)
            return "\(days)d"
        }
        let formatter = DateFormatter()
        formatter.dateFormat = Calendar.current.isDate(self, equalTo: now, toGranularity: .year)
            ? "MMM d"
            : "MMM d, yyyy"
        return formatter.string(from: self)
    }
}

#Preview {
    NavigationStack {
        InboxScreen()
    }
}
