import SwiftUI

/// Mixed feed of notes + chats sorted by most recently updated.
///
/// Driven by `FeedViewModel`. Tap a row to navigate to the detail view
/// (wired in Phase 4 — NoteDetailView / ChatThreadView).
public struct FeedView: View {
    var feedViewModel: FeedViewModel

    public init(feedViewModel: FeedViewModel) {
        self.feedViewModel = feedViewModel
    }

    public var body: some View {
        List {
            ForEach(feedViewModel.items) { item in
                FeedItemRow(item: item)
                    .listRowInsets(EdgeInsets(
                        top: AppleTheme.sm,
                        leading: AppleTheme.md,
                        bottom: AppleTheme.sm,
                        trailing: AppleTheme.md
                    ))
                    .listRowSeparator(.hidden)
            }
        }
        .listStyle(.plain)
        .navigationTitle("Feed")
        .overlay {
            if feedViewModel.isLoading && feedViewModel.items.isEmpty {
                ProgressView()
            } else if feedViewModel.items.isEmpty && !feedViewModel.isLoading {
                ContentUnavailableView(
                    "Nothing yet",
                    systemImage: "tray",
                    description: Text("Your notes and chats will appear here.")
                )
            }
        }
        .refreshable {
            await feedViewModel.refresh()
        }
        .task {
            if feedViewModel.items.isEmpty {
                await feedViewModel.refresh()
            }
        }
    }
}

// MARK: - FeedItemRow

private struct FeedItemRow: View {
    let item: FeedItem

    var body: some View {
        VStack(alignment: .leading, spacing: AppleTheme.xs) {
            HStack(alignment: .center, spacing: AppleTheme.sm) {
                Text(item.title)
                    .font(AppleTheme.bodyStrongFont)
                    .foregroundStyle(AppleTheme.foreground)
                    .lineLimit(1)

                Spacer()

                kindBadge
            }

            if item.preview.isEmpty == false {
                Text(item.preview)
                    .font(AppleTheme.captionFont)
                    .foregroundStyle(AppleTheme.secondaryText)
                    .lineLimit(2)
            }

            Text(item.relativeDate)
                .font(AppleTheme.monoCaptionFont)
                .foregroundStyle(AppleTheme.tertiaryText)
        }
        .padding(AppleTheme.sm12)
        .background(AppleTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: AppleTheme.cardRadius, style: .continuous))
    }

    @ViewBuilder
    private var kindBadge: some View {
        switch item.kind {
        case .note:
            Image(systemName: "note.text")
                .font(.caption2)
                .foregroundStyle(AppleTheme.tertiaryText)
        case .chat:
            Image(systemName: "bubble.left.and.bubble.right")
                .font(.caption2)
                .foregroundStyle(AppleTheme.tertiaryText)
        }
    }
}
