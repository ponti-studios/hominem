import Foundation
import Observation

/// Observable store that owns the chats list and the active message thread.
///
/// Wraps `ChatsService` with loading/error state. When a `LocalDatabase` is
/// provided, successful fetches and sends are written through to the cache, and
/// the cache is loaded on session restore so the UI has content before the first
/// network refresh completes.
@Observable
@MainActor
public final class ChatsStore {
    public private(set) var chats: [Chat] = []
    public private(set) var activeThread: [ChatMessage] = []
    public private(set) var activeChatId: String?
    public private(set) var isLoading = false
    public private(set) var isSending = false
    public private(set) var error: Error?

    private let service: ChatsService
    private let database: LocalDatabase?
    private var currentUserId: String?

    public init(service: ChatsService, database: LocalDatabase? = nil) {
        self.service = service
        self.database = database
    }

    // MARK: - Cache Hydration

    /// Load chats from the local cache so the UI has content before the first
    /// network refresh completes. Silently ignores cache misses or read errors.
    public func hydrateFromCache(userId: String) async {
        currentUserId = userId
        guard let database else { return }
        let cached = (try? await database.readChats(userId: userId)) ?? []
        if !cached.isEmpty {
            chats = cached
        }
    }

    /// Remove all persisted chats and messages for the current user.
    public func clearCache(userId: String) async {
        currentUserId = nil
        chats = []
        activeThread = []
        activeChatId = nil
        guard let database else { return }
        try? await database.clearChats(userId: userId)
        // Clear messages for all chats by clearing the full user scope
        try? await database.clearAll(userId: userId)
    }

    // MARK: - Fetch

    public func refresh() async {
        isLoading = true
        error = nil
        do {
            let fetched = try await service.listChats()
            chats = fetched
            // Write through to cache on success
            if let userId = currentUserId {
                try? await database?.writeChats(fetched, userId: userId)
            }
        } catch {
            // Preserve existing (possibly cached) chats on failure
            self.error = error
        }
        isLoading = false
    }

    // MARK: - Create

    @discardableResult
    public func createChat(title: String) async throws -> Chat {
        let chat = try await service.createChat(input: ChatsCreateInput(title: title))
        chats.insert(chat, at: 0)
        try? await database?.upsertChat(chat)
        return chat
    }

    // MARK: - Thread

    public func loadThread(chatId: String) async throws {
        activeChatId = chatId
        // Show cached messages immediately while the network fetch is pending
        if let cached = try? await database?.readMessages(chatId: chatId), !cached.isEmpty {
            activeThread = cached
        }
        do {
            let messages = try await service.getMessages(chatId: chatId)
            activeThread = messages
            // Write through to cache on success
            if let userId = currentUserId {
                try? await database?.writeMessages(messages, chatId: chatId, userId: userId)
            }
        } catch {
            // Keep cached thread visible; surface the error
            throw error
        }
    }

    public func clearThread() {
        activeChatId = nil
        activeThread = []
    }

    // MARK: - Send

    @discardableResult
    public func sendMessage(
        chatId: String,
        message: String,
        noteIds: [String]? = nil
    ) async throws -> ChatsSendOutput {
        isSending = true
        defer { isSending = false }
        let result = try await service.sendMessage(
            chatId: chatId,
            message: message,
            noteIds: noteIds
        )
        // Append new messages to the active thread
        if activeChatId == chatId {
            activeThread.append(result.messages.user)
            activeThread.append(result.messages.assistant)
            // Write through updated thread to cache
            if let userId = currentUserId {
                try? await database?.writeMessages(activeThread, chatId: chatId, userId: userId)
            }
        }
        return result
    }

    // MARK: - Archive

    public func archiveChat(id: String) async throws {
        _ = try await service.archiveChat(id: id)
        chats.removeAll { $0.id == id }
        try? await database?.clearMessages(chatId: id)
        if activeChatId == id {
            clearThread()
        }
    }

    // MARK: - Local lookup

    public func chat(id: String) -> Chat? {
        chats.first { $0.id == id }
    }

    public func clearError() {
        error = nil
    }
}
