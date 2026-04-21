import Foundation

// MARK: - ComposerAttachment

struct ComposerAttachment: Identifiable, Sendable, Equatable, Hashable {
    let id: String
    let name: String
    let mimeType: String
    let url: String

    var systemIcon: String {
        if mimeType.hasPrefix("image/") { return "photo" }
        if mimeType.hasPrefix("audio/") { return "waveform" }
        if mimeType.hasPrefix("video/") { return "film" }
        if mimeType == "application/pdf" { return "doc.richtext" }
        if mimeType.contains("word") { return "doc.text" }
        if mimeType.contains("csv") { return "tablecells" }
        return "paperclip"
    }
}

// MARK: - ComposerNote

struct ComposerNote: Identifiable, Sendable, Equatable, Hashable {
    let id: String
    let title: String?

    var displayTitle: String {
        let t = title?.trimmingCharacters(in: .whitespaces) ?? ""
        return t.isEmpty ? "Untitled note" : t
    }
}

// MARK: - ComposerDraft

struct ComposerDraft: Sendable {
    var text: String = ""
    var selectedNotes: [ComposerNote] = []
    var attachments: [ComposerAttachment] = []
}

// MARK: - ComposerState

@Observable @MainActor final class ComposerState {
    static let shared = ComposerState()

    private let userDefaults: UserDefaults

    init(userDefaults: UserDefaults = .standard) {
        self.userDefaults = userDefaults
    }

    // MARK: - Target

    enum Target: Equatable {
        case feed
        case chat(id: String)
        case hidden

        var key: String {
            switch self {
            case .feed:             "feed"
            case .chat(let id):     "chat:\(id)"
            case .hidden:           "hidden"
            }
        }

        var isHidden: Bool { self == .hidden }

        var placeholder: String {
            switch self {
            case .feed:     "Write a note, ask something…"
            case .chat:     "Message…"
            case .hidden:   ""
            }
        }

        var primaryLabel: String {
            switch self {
            case .chat: "Send"
            default:    "Save note"
            }
        }

        /// Feed target has a secondary "Start chat" action.
        var hasSecondaryAction: Bool {
            if case .feed = self { return true }
            return false
        }
    }

    // MARK: - State

    private(set) var target: Target = .feed
    private var drafts: [String: ComposerDraft] = [:]

    /// Set by `submitPrimary` on chat target; observed by ChatScreen to trigger reload.
    private(set) var messageSentChatId: String? = nil
    private(set) var messageSentCount: Int = 0

    /// Set while `submitPrimary` is in-flight for a chat target; observed by ChatScreen for ThinkingRow.
    private(set) var sendingChatId: String? = nil

    /// Non-nil when the last submit failed. Cleared on the next submit attempt or when the user edits the draft.
    private(set) var submitError: String? = nil

    /// True while the voice recorder is active; controls waveform UI in SharedComposerCard.
    private(set) var isRecording = false

    /// Mention suggestions (shown when text ends with `@query`).
    private(set) var mentionResults: [ComposerNote] = []
    private var mentionTask: Task<Void, Never>? = nil

    // MARK: - Computed

    var draftText: String {
        get { drafts[target.key]?.text ?? "" }
        set {
            ensureDraft()
            drafts[target.key]!.text = newValue
            updateMentionQuery(newValue)
            persistDraft()
            if submitError != nil { submitError = nil }
        }
    }

    var selectedNotes: [ComposerNote] {
        drafts[target.key]?.selectedNotes ?? []
    }

    var attachments: [ComposerAttachment] {
        drafts[target.key]?.attachments ?? []
    }

    var canSubmit: Bool {
        !draftText.trimmingCharacters(in: .whitespaces).isEmpty || !attachments.isEmpty
    }

    // MARK: - Target resolution

    /// Derives the composer target from the current sidebar selection.
    /// - nil selection  → feed (create note or start chat from sidebar)
    /// - .chat          → chat message input
    /// - .noteDetail    → hidden (note is edited inline)
    /// - .archivedChats → hidden (no composer in settings areas)
    func updateTarget(sidebarSelection: ProtectedRoute?) {
        let resolved: Target
        switch sidebarSelection {
        case nil:
            resolved = .feed
        case .chat(let id):
            resolved = .chat(id: id)
        case .noteDetail, .archivedChats:
            resolved = .hidden
        }

        if resolved != target {
            target = resolved
            restoreDraft()
        }
    }

    // MARK: - Draft manipulation

    func addNote(_ note: ComposerNote) {
        ensureDraft()
        guard !drafts[target.key]!.selectedNotes.contains(where: { $0.id == note.id }) else { return }
        drafts[target.key]!.selectedNotes.append(note)

        // Strip @mention query that triggered this selection
        let text = drafts[target.key]!.text
        if let q = getTrailingMentionQuery(text) {
            let tail = "@\(q)"
            if text.hasSuffix(tail) {
                drafts[target.key]!.text = String(text.dropLast(tail.count))
            }
        }
        mentionResults = []
        persistDraft()
    }

    func removeNote(id: String) {
        drafts[target.key]?.selectedNotes.removeAll { $0.id == id }
        persistDraft()
    }

    func addAttachment(_ attachment: ComposerAttachment) {
        ensureDraft()
        guard !drafts[target.key]!.attachments.contains(where: { $0.id == attachment.id }) else { return }
        guard drafts[target.key]!.attachments.count < FileUploadService.maxFileCount else { return }
        drafts[target.key]!.attachments.append(attachment)
    }

    func removeAttachment(id: String) {
        let toDelete = attachments.first(where: { $0.id == id })
        drafts[target.key]?.attachments.removeAll { $0.id == id }
        if let toDelete {
            Task { await FileUploadService.shared.deleteFile(id: toDelete.id) }
        }
    }

    func clearDraft() {
        drafts[target.key] = ComposerDraft()
        mentionResults = []
        clearPersistedDraft()
    }

    // MARK: - Primary submit

    func submitPrimary(router: Router) async {
        let text = draftText.trimmingCharacters(in: .whitespaces)
        let fileIds = attachments.map(\.id)
        guard !text.isEmpty || !fileIds.isEmpty else { return }

        submitError = nil

        switch target {
        case .feed:
            await submitNote(text: text, fileIds: fileIds, store: AppStores.shared.inbox) { detail in
                let title = detail.title ?? Self.derivedTitle(from: text)
                let note = InboxNote(id: detail.id, title: title, excerpt: Self.excerpt(from: detail.content), updatedAt: detail.updatedAt)
                return InboxItem.note(note)
            } placeholder: {
                let note = InboxNote(id: "tmp-\(UUID().uuidString)", title: Self.derivedTitle(from: text), excerpt: Self.excerpt(from: text), updatedAt: Date())
                return InboxItem.note(note)
            }
            TopAnchorSignal.inbox.request()

        case .chat(let chatId):
            do {
                sendingChatId = chatId
                try await ChatService.sendMessage(
                    chatId: chatId,
                    text: text,
                    fileIds: fileIds.isEmpty ? nil : fileIds
                )
                sendingChatId = nil
                clearDraft()
                messageSentChatId = chatId
                messageSentCount += 1
            } catch {
                sendingChatId = nil
                submitError = "Failed to send — tap to retry"
            }

        case .hidden:
            break
        }
    }

    // MARK: - Note submit helper

    private func submitNote<Item: Identifiable & Sendable>(
        text: String,
        fileIds: [String],
        store: QueryStore<Item>,
        commit: @escaping (NoteDetail) -> Item,
        placeholder: () -> Item
    ) async {
        let capturedText = text
        let capturedFileIds = fileIds
        let capturedAttachments = attachments
        let tempItem = placeholder()

        // Optimistic: clear the form immediately so the user has a fresh composer
        clearDraft()

        do {
            try await store.prepend(placeholder: tempItem) {
                let detail = try await NoteService.createNoteWithContent(
                    content: capturedText,
                    fileIds: capturedFileIds.isEmpty ? nil : capturedFileIds
                )
                return commit(detail)
            }
        } catch {
            // Roll back: restore draft and attachments so the user can retry
            draftText = capturedText
            if !capturedAttachments.isEmpty {
                ensureDraft()
                drafts[target.key]!.attachments = capturedAttachments
            }
            submitError = "Failed to save — tap to retry"
        }
    }

    // MARK: - Text helpers

    nonisolated private static func derivedTitle(from text: String) -> String {
        let firstLine = text.split(separator: "\n", maxSplits: 1).first.map(String.init) ?? text
        return String(firstLine.trimmingCharacters(in: .whitespaces).prefix(80))
    }

    nonisolated private static func excerpt(from text: String) -> String? {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count > 80 else { return nil }
        return String(trimmed.dropFirst(80).prefix(160))
    }

    // MARK: - Secondary submit (feed → start chat)

    func submitSecondary(router: Router) async {
        guard case .feed = target else { return }
        let text = draftText.trimmingCharacters(in: .whitespaces)
        let fileIds = attachments.map(\.id)
        guard !text.isEmpty || !fileIds.isEmpty else { return }

        submitError = nil

        do {
            let chat = try await ChatService.createChat(title: String(text.prefix(80)))
            try await ChatService.sendMessage(
                chatId: chat.id,
                text: text,
                fileIds: fileIds.isEmpty ? nil : fileIds
            )
            clearDraft()
            router.sidebarSelection = .chat(id: chat.id)
        } catch {
            // Non-fatal
        }
    }

    // MARK: - Mention search

    private func updateMentionQuery(_ text: String) {
        guard case .chat = target else {
            mentionResults = []
            return
        }
        guard let q = getTrailingMentionQuery(text), !q.isEmpty else {
            mentionResults = []
            return
        }
        mentionTask?.cancel()
        mentionTask = Task { await searchNotes(query: q) }
    }

    private func searchNotes(query: String) async {
        guard !Task.isCancelled else { return }
        var components = URLComponents(url: AuthService.apiURL("/api/notes/search"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "query", value: query),
            URLQueryItem(name: "limit", value: "5")
        ]
        guard let url = components.url else { return }
        var request = URLRequest(url: url)
        request.timeoutInterval = 5
        request.applyAuthHeaders()

        let data: Data
        do {
            let (responseData, _) = try await URLSession.shared.data(for: request)
            data = responseData
        } catch {
            // Mention search is best-effort; a network error just leaves results empty.
            return
        }

        guard !Task.isCancelled else { return }

        // Response may be `{ notes: [...] }` or a bare array
        let raw = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["notes"]
            as? [[String: Any]]
            ?? (try? JSONSerialization.jsonObject(with: data) as? [[String: Any]])
            ?? []

        mentionResults = raw.compactMap { d -> ComposerNote? in
            guard let id = d["id"] as? String else { return nil }
            return ComposerNote(id: id, title: d["title"] as? String)
        }
    }

    private func getTrailingMentionQuery(_ text: String) -> String? {
        guard let idx = text.lastIndex(of: "@") else { return nil }
        let before = text[..<idx]
        guard before.isEmpty || before.last?.isWhitespace == true else { return nil }
        return String(text[text.index(after: idx)...])
    }

    // MARK: - Voice input

    func startVoiceInput() async {
        isRecording = true
        await VoiceRecordingService.shared.startRecording()
    }

    func stopVoiceInput() {
        let text = VoiceRecordingService.shared.stopRecording()
        isRecording = false
        guard !text.isEmpty else { return }
        let current = draftText
        draftText = current.isEmpty ? text : "\(current) \(text)"
    }

    // MARK: - Draft persistence

    private var persistKey: String { "composer.draft.\(target.key)" }

    private func ensureDraft() {
        if drafts[target.key] == nil { drafts[target.key] = ComposerDraft() }
    }

    private func persistDraft() {
        guard let d = drafts[target.key], !d.text.isEmpty else {
            userDefaults.removeObject(forKey: persistKey)
            return
        }
        userDefaults.set(d.text, forKey: persistKey)
    }

    private func restoreDraft() {
        guard let saved = userDefaults.string(forKey: "composer.draft.\(target.key)"),
              !saved.isEmpty else { return }
        if drafts[target.key] == nil { drafts[target.key] = ComposerDraft() }
        drafts[target.key]!.text = saved
    }

    private func clearPersistedDraft() {
        userDefaults.removeObject(forKey: persistKey)
    }
}
