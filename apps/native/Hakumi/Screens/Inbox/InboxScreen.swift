import SwiftUI

// MARK: - InboxScreen

struct InboxScreen: View {
    @State private var items: [InboxItem] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var scrollPosition = ScrollPosition(idType: String.self)
    @State private var lastFetchDate: Date?

    // Re-fetch when the tab becomes visible again if data is stale (>30 s).
    private let staleness: TimeInterval = 30

    var body: some View {
        Group {
            if isLoading && items.isEmpty {
                loadingView
            } else if let msg = errorMessage, items.isEmpty {
                errorView(msg)
            } else if items.isEmpty {
                emptyView
            } else {
                feedList
            }
        }
        .navigationTitle("Inbox")
        .navigationBarTitleDisplayMode(.inline)
        .background(Color.Hakumi.bgBase)
        .task { await load() }
        .onAppear { refreshIfStale() }
        .onChange(of: TopAnchorSignal.inbox.pendingRequestId) { _, _ in
            scrollToTopIfPending()
        }
    }

    // MARK: Feed list

    private var feedList: some View {
        List {
            ForEach(items) { item in
                inboxRow(item)
                    .listRowBackground(Color.Hakumi.bgBase)
                    .listRowInsets(EdgeInsets(top: 0, leading: Spacing.lg, bottom: 0, trailing: Spacing.lg))
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .scrollPosition($scrollPosition)
        .refreshable { await load() }
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
                    date: chat.activityAt
                )
            }
        case .note(let note):
            NavigationLink(value: ProtectedRoute.noteDetail(id: note.id)) {
                InboxRowView(
                    icon: "note.text",
                    title: note.title,
                    subtitle: note.excerpt,
                    date: note.updatedAt
                )
            }
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
                .font(.system(size: 40))
                .foregroundStyle(Color.Hakumi.textTertiary)
            Text("Nothing here yet")
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(Color.Hakumi.textPrimary)
            Text("Chats and notes will appear here.")
                .font(.system(size: 13))
                .foregroundStyle(Color.Hakumi.textTertiary)
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

    /// Full fetch — replaces items while preserving scroll position.
    /// SwiftUI List diffs by `.id`, so rows with stable IDs stay anchored.
    private func load() async {
        guard !isLoading else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            let fresh = try await InboxService.fetchItems()
            withAnimation(.none) { items = fresh }
            lastFetchDate = Date()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    /// Refresh only if data is older than `staleness` seconds.
    private func refreshIfStale() {
        guard let last = lastFetchDate else { return }
        guard Date().timeIntervalSince(last) > staleness else { return }
        Task { await load() }
    }

    /// Scroll to the first item when there is an unhandled top-reveal request.
    private func scrollToTopIfPending() {
        guard TopAnchorSignal.inbox.hasPendingReveal,
              let firstId = items.first?.id else { return }
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

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.md) {
            Image(systemName: icon)
                .font(.system(size: 14))
                .foregroundStyle(Color.Hakumi.textTertiary)
                .frame(width: 20, height: 20)
                .padding(.top, 2)

            VStack(alignment: .leading, spacing: Spacing.xs) {
                Text(title)
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(Color.Hakumi.textPrimary)
                    .lineLimit(2)

                if let subtitle, !subtitle.isEmpty {
                    Text(subtitle)
                        .font(.system(size: 13))
                        .foregroundStyle(Color.Hakumi.textSecondary)
                        .lineLimit(2)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            Text(date.relativeString)
                .font(.system(size: 12))
                .foregroundStyle(Color.Hakumi.textTertiary)
                .padding(.top, 2)
        }
        .padding(.vertical, Spacing.sm)
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
