import SwiftUI

// MARK: - Send Status

private enum SendStatus: Equatable {
    case idle, sending, error
}

// MARK: - ChatScreen

struct ChatScreen: View {
    let id: String
    @Environment(Router.self) private var router

    // Load state
    @State private var isLoading = true
    @State private var chatTitle = "Chat"
    @State private var messages: [ChatMessage] = []

    // Local send state (used by regenerate and edit-message flows only)
    @State private var sendStatus: SendStatus = .idle
    @State private var sendError: String? = nil

    // UI state
    @State private var activeMessageId: String? = nil
    @State private var showActionsSheet = false
    @State private var showSearch = false
    @State private var searchQuery = ""
    @State private var editingMessage: ChatMessage? = nil
    @State private var editDraft = ""

    // Review overlay
    @State private var showReviewSheet = false
    @State private var reviewTitle = ""
    @State private var reviewContent = ""
    @State private var isSavingReview = false
    @State private var reviewSaved = false

    private var displayMessages: [ChatMessage] {
        let visible = messages.filter { $0.role != "tool" }
        guard !searchQuery.trimmingCharacters(in: .whitespaces).isEmpty else { return visible }
        let q = searchQuery.lowercased()
        return visible.filter { $0.content.lowercased().contains(q) }
    }

    private var isSending: Bool {
        sendStatus == .sending || ComposerState.shared.sendingChatId == id
    }

    private var hasAssistantMessages: Bool {
        messages.contains { $0.role == "assistant" }
    }

    private var lastAssistantContent: String {
        messages.last(where: { $0.role == "assistant" })?.content ?? ""
    }

    // MARK: - Body

    var body: some View {
        VStack(spacing: 0) {
            if showSearch {
                searchBar
                Color.Hakumi.borderDefault.frame(height: 1)
            }
            messageList
        }
        .background(Color.Hakumi.bgBase)
        .navigationTitle(chatTitle)
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Color.Hakumi.bgElevated, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .toolbar { chatToolbar }
        .confirmationDialog("Conversation", isPresented: $showActionsSheet, titleVisibility: .visible) {
            Button("Archive", role: .destructive) { Task { await archiveChat() } }
            Button("Search") { showSearch = true }
            if hasAssistantMessages {
                Button("Save as note…") { openReviewSheet() }
            }
            Button("Cancel", role: .cancel) {}
        }
        .sheet(item: $editingMessage) { message in
            editSheet(for: message)
                .presentationDetents([.medium])
                .presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $showReviewSheet) {
            reviewSheet
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
        }
        .alert("Send failed", isPresented: .constant(sendError != nil)) {
            Button("OK") { sendError = nil }
        } message: {
            Text(sendError ?? "")
        }
        .task { await load() }
        .onChange(of: ComposerState.shared.messageSentCount) { _, _ in
            guard ComposerState.shared.messageSentChatId == id else { return }
            Task { await reloadMessages() }
        }
    }

    // MARK: - Toolbar

    @ToolbarContentBuilder
    private var chatToolbar: some ToolbarContent {
        ToolbarItemGroup(placement: .topBarTrailing) {
            Button {
                showSearch.toggle()
                if !showSearch { searchQuery = "" }
            } label: {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(showSearch ? Color.Hakumi.accent : Color.Hakumi.textSecondary)
            }
            .accessibilityLabel("Search messages")

            Button { showActionsSheet = true } label: {
                Image(systemName: "ellipsis")
                    .foregroundStyle(Color.Hakumi.textSecondary)
            }
            .accessibilityLabel("Conversation actions")
        }
    }

    // MARK: - Search bar

    private var searchBar: some View {
        HStack(spacing: Spacing.sm) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 14))
                .foregroundStyle(Color.Hakumi.textTertiary)
            TextField("Search messages", text: $searchQuery)
                .font(.system(size: 15))
                .foregroundStyle(Color.Hakumi.textPrimary)
            if !searchQuery.isEmpty {
                Button { searchQuery = "" } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(Color.Hakumi.textTertiary)
                }
            }
            Button("Done") {
                showSearch = false
                searchQuery = ""
            }
            .font(.system(size: 15))
            .foregroundStyle(Color.Hakumi.accent)
        }
        .padding(.horizontal, Spacing.md)
        .padding(.vertical, 10)
        .background(Color.Hakumi.bgElevated)
    }

    // MARK: - Message list

    private var messageList: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 0) {
                    if isLoading {
                        loadingPlaceholder
                    } else if displayMessages.isEmpty && !searchQuery.isEmpty {
                        searchEmptyState
                    } else if displayMessages.isEmpty {
                        conversationEmptyState
                    } else {
                        ForEach(displayMessages) { message in
                            messageRow(message)
                        }
                    }
                    if isSending {
                        ThinkingRow()
                            .padding(.horizontal, Spacing.md)
                    }
                    Color.clear.frame(height: 1).id("chat-bottom")
                }
                .padding(.top, Spacing.sm)
                .padding(.bottom, Spacing.md)
            }
            .onChange(of: messages) { _, _ in
                withAnimation(.none) { proxy.scrollTo("chat-bottom", anchor: .bottom) }
            }
            .onChange(of: sendStatus) { _, _ in
                withAnimation(.none) { proxy.scrollTo("chat-bottom", anchor: .bottom) }
            }
            .onChange(of: ComposerState.shared.sendingChatId) { _, chatId in
                guard chatId == id else { return }
                withAnimation(.none) { proxy.scrollTo("chat-bottom", anchor: .bottom) }
            }
        }
    }

    // MARK: - Message row

    @ViewBuilder
    private func messageRow(_ message: ChatMessage) -> some View {
        let isUser = message.role == "user"
        let isActive = activeMessageId == message.id

        VStack(alignment: isUser ? .trailing : .leading, spacing: Spacing.xs) {
            // Reasoning block (assistant only)
            if !isUser, let reasoning = message.reasoning, !reasoning.trimmingCharacters(in: .whitespaces).isEmpty {
                Text(reasoning)
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundStyle(Color.Hakumi.textTertiary)
                    .padding(Spacing.sm)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.Hakumi.bgSurface)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.sm))
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.sm)
                            .strokeBorder(Color.Hakumi.borderSubtle, lineWidth: 1)
                    )
            }

            // Bubble
            HStack(spacing: 0) {
                if isUser { Spacer(minLength: 56) }
                Text(message.content)
                    .font(.system(size: 15))
                    .lineSpacing(3)
                    .foregroundStyle(isUser ? Color.Hakumi.accentForeground : Color.Hakumi.textPrimary)
                    .padding(.horizontal, Spacing.sm)
                    .padding(.vertical, Spacing.sm)
                    .background(isUser ? Color.Hakumi.emphasisHighest : Color.Hakumi.bgSurface)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md))
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.md)
                            .strokeBorder(Color.Hakumi.borderSubtle, lineWidth: 1)
                            .opacity(isUser ? 0 : 1)
                    )
                if !isUser { Spacer(minLength: 56) }
            }

            // Action row — tap to reveal
            if isActive {
                messageActionRow(message)
                    .transition(.asymmetric(
                        insertion: .move(edge: .top).combined(with: .opacity),
                        removal: .opacity
                    ))
            }
        }
        .padding(.horizontal, Spacing.md)
        .padding(.vertical, Spacing.xs)
        .contentShape(Rectangle())
        .onTapGesture {
            withAnimation(.spring(duration: 0.22)) {
                activeMessageId = activeMessageId == message.id ? nil : message.id
            }
        }
    }

    // MARK: - Message action row

    @ViewBuilder
    private func messageActionRow(_ message: ChatMessage) -> some View {
        let isUser = message.role == "user"
        HStack(spacing: Spacing.sm) {
            Text(formatDate(message.createdAt))
                .font(.system(size: 11, design: .monospaced))
                .foregroundStyle(Color.Hakumi.textTertiary)

            Spacer()

            // Copy
            Button {
                UIPasteboard.general.string = message.content
                withAnimation { activeMessageId = nil }
            } label: {
                Image(systemName: "doc.on.doc")
                    .font(.system(size: 14))
                    .foregroundStyle(Color.Hakumi.textTertiary)
            }
            .accessibilityLabel("Copy message")

            // Share (assistant only)
            if !isUser {
                ShareLink(item: message.content) {
                    Image(systemName: "square.and.arrow.up")
                        .font(.system(size: 14))
                        .foregroundStyle(Color.Hakumi.textTertiary)
                }
                .accessibilityLabel("Share message")
            }

            // Edit (user only)
            if isUser {
                Button {
                    editDraft = message.content
                    withAnimation { activeMessageId = nil }
                    editingMessage = message
                } label: {
                    Image(systemName: "square.and.pencil")
                        .font(.system(size: 14))
                        .foregroundStyle(Color.Hakumi.textTertiary)
                }
                .accessibilityLabel("Edit message")
            }

            // Regenerate (assistant only)
            if !isUser {
                Button {
                    withAnimation { activeMessageId = nil }
                    Task { await regenerate(messageId: message.id) }
                } label: {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 14))
                        .foregroundStyle(Color.Hakumi.textTertiary)
                }
                .accessibilityLabel("Regenerate response")
                .disabled(sendStatus != .idle)
            }
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Edit sheet

    @ViewBuilder
    private func editSheet(for message: ChatMessage) -> some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            Text("Edit message")
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(Color.Hakumi.textPrimary)

            TextEditor(text: $editDraft)
                .font(.system(size: 15))
                .foregroundStyle(Color.Hakumi.textPrimary)
                .scrollContentBackground(.hidden)
                .frame(minHeight: 100)
                .padding(Spacing.sm)
                .background(Color.Hakumi.bgSurface)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md))
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md)
                        .strokeBorder(Color.Hakumi.borderDefault, lineWidth: 1)
                )

            HStack(spacing: Spacing.sm) {
                Spacer()
                Button("Cancel") { editingMessage = nil }
                    .font(.system(size: 15))
                    .foregroundStyle(Color.Hakumi.textSecondary)
                    .padding(.horizontal, Spacing.md)
                    .padding(.vertical, Spacing.sm)
                    .background(Color.Hakumi.bgSurface)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.sm))
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.sm)
                            .strokeBorder(Color.Hakumi.borderDefault, lineWidth: 1)
                    )

                Button("Send") {
                    let text = editDraft.trimmingCharacters(in: .whitespaces)
                    guard !text.isEmpty else { return }
                    editingMessage = nil
                    Task { await send(text: text) }
                }
                .font(.system(size: 15, weight: .medium))
                .foregroundStyle(Color.Hakumi.accentForeground)
                .padding(.horizontal, Spacing.md)
                .padding(.vertical, Spacing.sm)
                .background(editDraft.trimmingCharacters(in: .whitespaces).isEmpty
                    ? Color.Hakumi.textDisabled : Color.Hakumi.accent)
                .clipShape(RoundedRectangle(cornerRadius: Radii.sm))
                .disabled(editDraft.trimmingCharacters(in: .whitespaces).isEmpty)
            }
        }
        .padding(Spacing.lg)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(Color.Hakumi.bgBase)
    }

    // MARK: - Review sheet

    private var reviewSheet: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("SAVE AS NOTE")
                        .font(.system(size: 11, weight: .semibold, design: .monospaced))
                        .foregroundStyle(Color.Hakumi.textTertiary)
                        .kerning(1)
                    Text("Review before saving")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Color.Hakumi.textPrimary)
                }
                Spacer()
                Button { showReviewSheet = false } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 22))
                        .foregroundStyle(Color.Hakumi.textTertiary)
                }
            }

            VStack(alignment: .leading, spacing: Spacing.xs) {
                Text("TITLE")
                    .font(.system(size: 11, weight: .semibold, design: .monospaced))
                    .foregroundStyle(Color.Hakumi.textTertiary)
                    .kerning(1)
                TextField("Note title", text: $reviewTitle)
                    .font(.system(size: 15))
                    .foregroundStyle(Color.Hakumi.textPrimary)
                    .padding(Spacing.sm)
                    .background(Color.Hakumi.bgSurface)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md))
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.md)
                            .strokeBorder(Color.Hakumi.borderDefault, lineWidth: 1)
                    )
            }

            VStack(alignment: .leading, spacing: Spacing.xs) {
                Text("PREVIEW")
                    .font(.system(size: 11, weight: .semibold, design: .monospaced))
                    .foregroundStyle(Color.Hakumi.textTertiary)
                    .kerning(1)
                ScrollView {
                    Text(reviewContent)
                        .font(.system(size: 13, design: .monospaced))
                        .foregroundStyle(Color.Hakumi.textSecondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(Spacing.sm)
                }
                .frame(maxHeight: 160)
                .background(Color.Hakumi.bgSurface)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md))
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md)
                        .strokeBorder(Color.Hakumi.borderDefault, lineWidth: 1)
                )
            }

            Spacer()

            HStack(spacing: Spacing.sm) {
                Button("Discard") { showReviewSheet = false }
                    .font(.system(size: 15))
                    .foregroundStyle(Color.Hakumi.textSecondary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, Spacing.sm)
                    .background(Color.Hakumi.bgSurface)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md))
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.md)
                            .strokeBorder(Color.Hakumi.borderDefault, lineWidth: 1)
                    )

                Button {
                    Task { await saveReview() }
                } label: {
                    if isSavingReview {
                        ProgressView()
                            .tint(Color.Hakumi.accentForeground)
                            .frame(maxWidth: .infinity)
                    } else if reviewSaved {
                        Label("Saved", systemImage: "checkmark")
                            .font(.system(size: 15, weight: .medium))
                            .foregroundStyle(Color.Hakumi.accentForeground)
                            .frame(maxWidth: .infinity)
                    } else {
                        Text("Save note")
                            .font(.system(size: 15, weight: .medium))
                            .foregroundStyle(Color.Hakumi.accentForeground)
                            .frame(maxWidth: .infinity)
                    }
                }
                .padding(.vertical, Spacing.sm)
                .background(reviewSaved ? Color.Hakumi.success : Color.Hakumi.accent)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md))
                .disabled(isSavingReview || reviewSaved || reviewTitle.trimmingCharacters(in: .whitespaces).isEmpty)
            }
        }
        .padding(Spacing.lg)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(Color.Hakumi.bgBase)
    }

    // MARK: - Empty / loading states

    private var loadingPlaceholder: some View {
        VStack(spacing: Spacing.md) {
            ForEach(0..<4, id: \.self) { _ in
                RoundedRectangle(cornerRadius: Radii.md)
                    .fill(Color.Hakumi.bgSurface)
                    .frame(height: 52)
            }
        }
        .padding(.horizontal, Spacing.md)
        .padding(.top, Spacing.md)
        .redacted(reason: .placeholder)
    }

    private var conversationEmptyState: some View {
        VStack(spacing: Spacing.sm) {
            Image(systemName: "bubble.left.and.bubble.right")
                .font(.system(size: 36))
                .foregroundStyle(Color.Hakumi.textTertiary)
            Text("Start a conversation")
                .font(.system(size: 16, weight: .medium))
                .foregroundStyle(Color.Hakumi.textSecondary)
            Text("Type a message below to get started.")
                .font(.system(size: 14))
                .foregroundStyle(Color.Hakumi.textTertiary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 80)
        .padding(.horizontal, Spacing.lg)
    }

    private var searchEmptyState: some View {
        VStack(spacing: Spacing.sm) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 36))
                .foregroundStyle(Color.Hakumi.textTertiary)
            Text("No results for \"\(searchQuery)\"")
                .font(.system(size: 15))
                .foregroundStyle(Color.Hakumi.textSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 80)
        .padding(.horizontal, Spacing.lg)
    }

    // MARK: - Async actions

    private func load() async {
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

    /// Used by regenerate and edit-message flows. SharedComposerCard sends are handled
    /// via `ComposerState.submitPrimary`; ChatScreen reloads on `messageSentCount` change.
    private func send(text: String) async {
        guard !text.isEmpty, sendStatus == .idle else { return }

        let optimisticId = UUID().uuidString
        let optimistic = ChatMessage(
            id: optimisticId,
            chatId: id,
            role: "user",
            content: text,
            createdAt: Date(),
            isOptimistic: true
        )
        messages.append(optimistic)
        sendStatus = .sending
        sendError = nil

        do {
            try await ChatService.sendMessage(chatId: id, text: text)
            sendStatus = .idle
            await reloadMessages()
        } catch {
            sendStatus = .error
            sendError = error.localizedDescription
            messages.removeAll { $0.id == optimisticId }
        }
    }

    private func reloadMessages() async {
        async let freshMessages = ChatService.fetchMessages(chatId: id)
        async let freshDetail = ChatService.fetchChatDetail(id: id)
        if let (msgs, detail) = try? await (freshMessages, freshDetail) {
            messages = msgs
            if detail.title != "New conversation" || chatTitle == "Chat" {
                chatTitle = detail.title
            }
        } else if let msgs = try? await ChatService.fetchMessages(chatId: id) {
            messages = msgs
        }
    }

    private func archiveChat() async {
        do {
            try await ChatService.archiveChat(id: id)
            router.selectedTab = .inbox
            router.protectedPath = []
        } catch {
            // TODO: surface error in Phase 4.2
        }
    }

    private func openReviewSheet() {
        let assistantContent = lastAssistantContent
        let titleBase = chatTitle == "Chat" || chatTitle == "New conversation" ? "Note from conversation" : chatTitle
        reviewTitle = String(titleBase.prefix(80))
        reviewContent = String(assistantContent.prefix(2000))
        reviewSaved = false
        isSavingReview = false
        showReviewSheet = true
    }

    private func saveReview() async {
        let title = reviewTitle.trimmingCharacters(in: .whitespaces)
        guard !title.isEmpty else { return }
        isSavingReview = true
        do {
            _ = try await ChatService.createNoteFromConversation(title: title, content: reviewContent)
            isSavingReview = false
            reviewSaved = true
            try? await Task.sleep(for: .seconds(1.2))
            showReviewSheet = false
        } catch {
            isSavingReview = false
        }
    }

    private func regenerate(messageId: String) async {
        guard let idx = messages.firstIndex(where: { $0.id == messageId }) else { return }
        let previousUser = messages[..<idx].reversed().first(where: {
            $0.role == "user" && !$0.content.trimmingCharacters(in: .whitespaces).isEmpty
        })
        guard let prevMsg = previousUser else { return }
        await send(text: prevMsg.content)
    }

    // MARK: - Helpers

    private func formatDate(_ date: Date) -> String {
        let f = DateFormatter()
        f.dateStyle = .none
        f.timeStyle = .short
        return f.string(from: date)
    }
}

// MARK: - Thinking indicator

private struct ThinkingRow: View {
    var body: some View {
        HStack {
            HStack(spacing: 4) {
                ForEach(0..<3) { i in
                    ThinkingDot(delay: Double(i) * 0.18)
                }
            }
            .padding(.horizontal, Spacing.sm)
            .padding(.vertical, Spacing.sm)
            .background(Color.Hakumi.bgSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md)
                    .strokeBorder(Color.Hakumi.borderSubtle, lineWidth: 1)
            )
            Spacer()
        }
        .padding(.vertical, Spacing.xs)
    }
}

private struct ThinkingDot: View {
    let delay: Double
    @State private var isAnimating = false

    var body: some View {
        Circle()
            .fill(Color.Hakumi.textTertiary)
            .frame(width: 6, height: 6)
            .scaleEffect(isAnimating ? 1.25 : 0.75)
            .opacity(isAnimating ? 1.0 : 0.3)
            .onAppear {
                withAnimation(
                    .easeInOut(duration: 0.55)
                    .repeatForever(autoreverses: true)
                    .delay(delay)
                ) {
                    isAnimating = true
                }
            }
    }
}

// MARK: - Preview

#Preview {
    NavigationStack {
        ChatScreen(id: "preview-id")
            .environment(Router())
    }
}
