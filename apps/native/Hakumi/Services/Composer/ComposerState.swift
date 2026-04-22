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

    // MARK: - Target

    enum Target: Equatable {
        case feed
        case chat(id: String)
        case notes
        case hidden

        var key: String {
            switch self {
            case .feed:             "feed"
            case .chat(let id):     "chat:\(id)"
            case .notes:            "notes"
            case .hidden:           "hidden"
            }
        }

        var isHidden: Bool { self == .hidden }

        var placeholder: String {
            switch self {
            case .feed:     "Write a note, ask something…"
            case .chat:     "Message…"
            case .notes:    "Write into your notes…"
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

    func updateTarget(
        selectedTab: ProtectedTab,
        protectedPath: [ProtectedRoute],
        notesPath: [ProtectedRoute]
    ) {
        let resolved: Target
        switch selectedTab {
        case .settings:
            resolved = .hidden

        case .notes:
            resolved = notesPath.isEmpty ? .notes : .hidden

        case .inbox:
            // Look for a .chat route at the top of the inbox path
            let chatRoute = protectedPath.first {
                if case .chat = $0 { return true }; return false
            }
            if let chatRoute, case .chat(let id) = chatRoute {
                resolved = .chat(id: id)
            } else {
                resolved = .feed
            }
        }

        if resolved != target {
            target = resolved
            // Restore persisted draft for this target
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

        switch target {
        case .feed, .notes:
            do {
                _ = try await NoteService.createNoteWithContent(
                    content: text,
                    fileIds: fileIds.isEmpty ? nil : fileIds
                )
                clearDraft()
                if case .feed = target {
                    TopAnchorSignal.inbox.request()
                }
            } catch {
                // Non-fatal: draft preserved for retry
            }

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
                // Non-fatal
            }

        case .hidden:
            break
        }
    }

    // MARK: - Secondary submit (feed → start chat)

    func submitSecondary(router: Router) async {
        guard case .feed = target else { return }
        let text = draftText.trimmingCharacters(in: .whitespaces)
        let fileIds = attachments.map(\.id)
        guard !text.isEmpty || !fileIds.isEmpty else { return }

        do {
            let chat = try await ChatService.createChat(title: String(text.prefix(80)))
            try await ChatService.sendMessage(
                chatId: chat.id,
                text: text,
                fileIds: fileIds.isEmpty ? nil : fileIds
            )
            clearDraft()
            router.selectedTab = .inbox
            router.protectedPath = [.chat(id: chat.id)]
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
        let encoded = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? query
        let url = AuthService.apiURL("/api/notes/search?query=\(encoded)&limit=5")
        var request = URLRequest(url: url)
        request.timeoutInterval = 5
        let headers = AuthProvider.shared.getAuthHeaders()
        for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }

        guard let (data, _) = try? await URLSession.shared.data(for: request),
              !Task.isCancelled else { return }

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

    // MARK: - Draft persistence

    private var persistKey: String { "composer.draft.\(target.key)" }

    private func ensureDraft() {
        if drafts[target.key] == nil { drafts[target.key] = ComposerDraft() }
    }

    private func persistDraft() {
        guard let d = drafts[target.key], !d.text.isEmpty else {
            UserDefaults.standard.removeObject(forKey: persistKey)
            return
        }
        UserDefaults.standard.set(d.text, forKey: persistKey)
    }

    private func restoreDraft() {
        guard let saved = UserDefaults.standard.string(forKey: "composer.draft.\(target.key)"),
              !saved.isEmpty else { return }
        if drafts[target.key] == nil { drafts[target.key] = ComposerDraft() }
        drafts[target.key]!.text = saved
    }

    private func clearPersistedDraft() {
        UserDefaults.standard.removeObject(forKey: persistKey)
    }
}
