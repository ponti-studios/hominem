import SwiftUI

// MARK: - InboxScreen

struct InboxScreen: View {
    private var store: QueryStore<InboxItem> { AppStores.shared.inbox }
    @State private var scrollPosition = ScrollPosition(idType: String.self)

    var body: some View {
        Group {
            if store.isFirstLoad {
                loadingView
            } else if let msg = store.errorMessage, store.isEmpty {
                errorView(msg)
            } else if store.isEmpty {
                emptyView
            } else {
                feedList
            }
        }
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
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .scrollPosition($scrollPosition)
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

            if isPending {
                ProgressView()
                    .scaleEffect(0.7)
                    .tint(Color.Hakumi.textTertiary)
                    .padding(.top, 2)
            } else {
                Text(date.relativeString)
                    .font(.system(size: 12))
                    .foregroundStyle(Color.Hakumi.textTertiary)
                    .padding(.top, 2)
            }
        }
        .padding(.vertical, Spacing.sm)
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
