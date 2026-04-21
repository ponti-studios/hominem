import Foundation

enum SendStatus: Equatable {
    case idle, sending, error
}

@Observable
@MainActor
final class ChatViewModel {

    private(set) var isLoading = true
    private(set) var chatTitle = "Chat"
    private(set) var messages: [ChatMessage] = []
    private(set) var sendStatus: SendStatus = .idle
    private(set) var sendError: String? = nil

    // MARK: Load

    func load(id: String) async {
        isLoading = true
        do {
            async let detail = ChatService.fetchChatDetail(id: id)
            async let msgs = ChatService.fetchMessages(chatId: id)
            let (chatDetail, fetched) = try await (detail, msgs)
            chatTitle = chatDetail.title
            messages = fetched
        } catch {
            // Non-fatal — keep placeholder title, empty list
        }
        isLoading = false
    }

    func reloadMessages(id: String) async {
        do {
            async let msgs = ChatService.fetchMessages(chatId: id)
            async let detail = ChatService.fetchChatDetail(id: id)
            let (fetchedMsgs, fetchedDetail) = try await (msgs, detail)
            messages = fetchedMsgs
            chatTitle = fetchedDetail.title
        } catch {
            // silent — messages already loaded; title stays as-is
        }
    }

    // MARK: Send

    /// Used by regenerate and edit-message flows.
    /// Composer sends are handled via `ComposerState.submitPrimary`;
    /// ChatScreen reloads on `messageSentCount` change.
    func send(text: String, chatId: String) async {
        guard !text.isEmpty, sendStatus == .idle else { return }

        let optimisticId = UUID().uuidString
        let optimistic = ChatMessage(
            id: optimisticId,
            chatId: chatId,
            role: .user,
            content: text,
            createdAt: Date(),
            isOptimistic: true
        )
        messages.append(optimistic)
        sendStatus = .sending
        sendError = nil

        do {
            try await ChatService.sendMessage(chatId: chatId, text: text)
            sendStatus = .idle
            await reloadMessages(id: chatId)
        } catch {
            sendStatus = .error
            sendError = error.localizedDescription
            messages.removeAll { $0.id == optimisticId }
        }
    }

    func clearSendError() {
        sendError = nil
        sendStatus = .idle
    }

    // MARK: Regenerate

    func regenerate(messageId: String, chatId: String) async {
        guard let idx = messages.firstIndex(where: { $0.id == messageId }) else { return }
        let previousUser = messages[..<idx].reversed().first(where: {
            $0.role == .user && !$0.content.trimmingCharacters(in: .whitespaces).isEmpty
        })
        guard let prevMsg = previousUser else { return }
        await send(text: prevMsg.content, chatId: chatId)
    }

    // MARK: Save as note

    /// Returns `true` on success.
    func saveAsNote(title: String, content: String) async -> Bool {
        let trimmedTitle = title.trimmingCharacters(in: .whitespaces)
        guard !trimmedTitle.isEmpty else { return false }
        do {
            _ = try await ChatService.createNoteFromConversation(title: trimmedTitle, content: content)
            return true
        } catch {
            return false
        }
    }
}
