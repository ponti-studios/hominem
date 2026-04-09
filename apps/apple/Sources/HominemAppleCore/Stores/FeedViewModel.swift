import Foundation
import Observation

// MARK: - FeedItem

public enum FeedItemKind: Sendable {
    case note(Note)
    case chat(Chat)
}

public struct FeedItem: Identifiable, Sendable {
    public let id: String
    public let title: String
    public let preview: String
    public let updatedAt: String
    public let kind: FeedItemKind

    public init(id: String, title: String, preview: String, updatedAt: String, kind: FeedItemKind) {
        self.id = id
        self.title = title
        self.preview = preview
        self.updatedAt = updatedAt
        self.kind = kind
    }

    public var relativeDate: String {
        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = isoFormatter.date(from: updatedAt)
            ?? ISO8601DateFormatter().date(from: updatedAt)
        guard let date else { return updatedAt }
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .short
        return formatter.localizedString(for: date, relativeTo: Date.now)
    }
}

// MARK: - FeedViewModel

/// Merges notes + chats sorted by `updatedAt` descending.
///
/// Backed by `NotesStore` and `ChatsStore`; call `refresh()` to fetch both
/// and rebuild the merged list atomically.
@Observable
@MainActor
public final class FeedViewModel {
    public private(set) var items: [FeedItem] = []
    public private(set) var isLoading = false
    public private(set) var error: Error?

    private let notesStore: NotesStore
    private let chatsStore: ChatsStore

    public init(notesStore: NotesStore, chatsStore: ChatsStore) {
        self.notesStore = notesStore
        self.chatsStore = chatsStore
    }

    // MARK: - Refresh

    public func refresh() async {
        isLoading = true
        error = nil
        await notesStore.refresh()
        await chatsStore.refresh()
        error = notesStore.error ?? chatsStore.error
        // Always rebuild from whatever content the stores now hold — including
        // cached content that survived an offline refresh failure.
        rebuild()
        isLoading = false
    }

    // MARK: - Rebuild

    /// Merge and re-sort from the stores without hitting the network.
    public func rebuild() {
        let noteItems = notesStore.notes.map { note in
            FeedItem(
                id: "note-\(note.id)",
                title: note.title ?? "Untitled",
                preview: note.excerpt ?? String(note.content.prefix(120)),
                updatedAt: note.updatedAt,
                kind: .note(note)
            )
        }
        let chatItems = chatsStore.chats.map { chat in
            FeedItem(
                id: "chat-\(chat.id)",
                title: chat.title,
                preview: "",
                updatedAt: chat.updatedAt,
                kind: .chat(chat)
            )
        }
        items = (noteItems + chatItems).sorted { $0.updatedAt > $1.updatedAt }
    }

    public func clearError() {
        error = nil
        notesStore.clearError()
        chatsStore.clearError()
    }
}

// MARK: - Note date helper

extension Note {
    public var relativeDate: String {
        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = isoFormatter.date(from: updatedAt)
            ?? ISO8601DateFormatter().date(from: updatedAt)
        guard let date else { return updatedAt }
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .short
        return formatter.localizedString(for: date, relativeTo: Date.now)
    }
}
