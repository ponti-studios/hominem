import SwiftUI

// MARK: - ChatScreen

struct ChatScreen: View {
    let id: String
    @Environment(Router.self) private var router
    @Environment(ComposerState.self) private var composerState
    @Environment(AppStores.self) private var stores

    @State private var vm = ChatViewModel()

    // UI state
    @State private var activeMessageId: String? = nil
    @State private var showActionsSheet = false
    @State private var searchQuery: String? = nil  // nil = search hidden
    @State private var editingMessage: ChatMessage? = nil
    @State private var editDraft = ""
    @State private var isNearBottom = true

    // Review overlay
    private struct ReviewDraft {
        var title: String
        var content: String
        var isSaving = false
        var saved = false
    }
    @State private var reviewDraft: ReviewDraft? = nil

    private var displayMessages: [ChatMessage] {
        let visible = vm.messages.filter { $0.role != .tool }
        guard let q = searchQuery, !q.trimmingCharacters(in: .whitespaces).isEmpty else { return visible }
        return visible.filter { $0.content.lowercased().contains(q.lowercased()) }
    }

    private var isSending: Bool {
        vm.sendStatus == .sending || composerState.sendingChatId == id
    }

    private var hasAssistantMessages: Bool {
        vm.messages.contains { $0.role == .assistant }
    }

    private var lastAssistantContent: String {
        vm.messages.last(where: { $0.role == .assistant })?.content ?? ""
    }

    // MARK: - Body

    var body: some View {
        VStack(spacing: 0) {
            if searchQuery != nil {
                searchBar
                Color.Hakumi.borderDefault.frame(height: 1)
            }
            messageList
        }
        .background(Color.Hakumi.bgBase)
        .navigationTitle(vm.chatTitle)
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Color.Hakumi.bgElevated, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .toolbar { chatToolbar }
        .confirmationDialog("Conversation", isPresented: $showActionsSheet, titleVisibility: .visible) {
            Button("Archive", role: .destructive) {
                Task {
                    await stores.archiveChat(id: id)
                    router.sidebarSelection = nil
                }
            }
            Button("Search") { searchQuery = "" }
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
        .sheet(isPresented: Binding(
            get: { reviewDraft != nil },
            set: { if !$0 { reviewDraft = nil } }
        )) {
            reviewSheet
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
        }
        .alert("Send failed", isPresented: Binding(
            get: { vm.sendError != nil },
            set: { if !$0 { vm.clearSendError() } }
        )) {
            Button("OK") {}
        } message: {
            Text(vm.sendError ?? "")
        }
        .task { await vm.load(id: id) }
        .onChange(of: composerState.messageSentCount) { _, _ in
            guard composerState.messageSentChatId == id else { return }
            Task { await vm.reloadMessages(id: id) }
        }
    }

    // MARK: - Toolbar

    @ToolbarContentBuilder
    private var chatToolbar: some ToolbarContent {
        ToolbarItemGroup(placement: .topBarTrailing) {
            Button {
                searchQuery = searchQuery == nil ? "" : nil
            } label: {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(searchQuery != nil ? Color.Hakumi.accent : Color.Hakumi.textSecondary)
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
            TextField("Search messages", text: Binding(
                get: { searchQuery ?? "" },
                set: { searchQuery = $0 }
            ))
            .textStyle(AppTypography.subhead)
            .foregroundStyle(Color.Hakumi.textPrimary)
            if (searchQuery ?? "").isEmpty == false {
                Button {
                    searchQuery = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(Color.Hakumi.textTertiary)
                }
            }
            Button("Done") {
                searchQuery = nil
            }
            .textStyle(AppTypography.subhead)
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
                    if vm.isLoading {
                        loadingPlaceholder
                    } else if displayMessages.isEmpty && searchQuery != nil {
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
            .onScrollGeometryChange(for: Bool.self) { geo in
                geo.contentSize.height - geo.visibleRect.maxY < 120
            } action: { _, nearBottom in
                isNearBottom = nearBottom
            }
            .onChange(of: vm.messages.count) { _, _ in
                if isNearBottom { scrollToBottom(proxy: proxy) }
            }
            .onChange(of: vm.sendStatus) { _, _ in
                if isNearBottom { scrollToBottom(proxy: proxy) }
            }
            .onChange(of: composerState.sendingChatId) { _, chatId in
                guard chatId == id else { return }
                // Always scroll when user sends their own message
                scrollToBottom(proxy: proxy)
            }
        }
    }

    // MARK: - Message row

    @ViewBuilder
    private func messageRow(_ message: ChatMessage) -> some View {
        let isUser = message.role == .user
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
        let isUser = message.role == .user
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
                    Task { await vm.regenerate(messageId: message.id, chatId: id) }
                } label: {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 14))
                        .foregroundStyle(Color.Hakumi.textTertiary)
                }
                .accessibilityLabel("Regenerate response")
                .disabled(vm.sendStatus != .idle)
            }
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Edit sheet

    @ViewBuilder
    private func editSheet(for message: ChatMessage) -> some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            Text("Edit message")
                .textStyle(AppTypography.headline)
                .foregroundStyle(Color.Hakumi.textPrimary)

            TextEditor(text: $editDraft)
                .font(.system(size: 15))
                .foregroundStyle(Color.Hakumi.textPrimary)
                .scrollContentBackground(.hidden)
                .frame(minHeight: 100)
                .padding(Spacing.sm)
                .cardStyle(radius: Radii.md)

            HStack(spacing: Spacing.sm) {
                Spacer()
                Button("Cancel") { editingMessage = nil }
                    .textStyle(AppTypography.subhead)
                    .foregroundStyle(Color.Hakumi.textSecondary)
                    .padding(.horizontal, Spacing.md)
                    .padding(.vertical, Spacing.sm)
                    .cardStyle()

                Button("Send") {
                    let text = editDraft.trimmingCharacters(in: .whitespaces)
                    guard !text.isEmpty else { return }
                    editingMessage = nil
                    Task { await vm.send(text: text, chatId: id) }
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
                Button { reviewDraft = nil } label: {
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
                TextField("Note title", text: Binding(
                    get: { reviewDraft?.title ?? "" },
                    set: { reviewDraft?.title = $0 }
                ))
                    .font(.system(size: 15))
                    .foregroundStyle(Color.Hakumi.textPrimary)
                    .padding(Spacing.sm)
                    .cardStyle(radius: Radii.md)
            }

            VStack(alignment: .leading, spacing: Spacing.xs) {
                Text("PREVIEW")
                    .font(.system(size: 11, weight: .semibold, design: .monospaced))
                    .foregroundStyle(Color.Hakumi.textTertiary)
                    .kerning(1)
                ScrollView {
                    Text(reviewDraft?.content ?? "")
                        .font(.system(size: 13, design: .monospaced))
                        .foregroundStyle(Color.Hakumi.textSecondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(Spacing.sm)
                }
                .frame(maxHeight: 160)
                .cardStyle(radius: Radii.md)
            }

            Spacer()

            HStack(spacing: Spacing.sm) {
                Button("Discard") { reviewDraft = nil }
                    .textStyle(AppTypography.subhead)
                    .foregroundStyle(Color.Hakumi.textSecondary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, Spacing.sm)
                    .cardStyle(radius: Radii.md)

                Button {
                    Task { await saveReview() }
                } label: {
                    if reviewDraft?.isSaving == true {
                        ProgressView()
                            .tint(Color.Hakumi.accentForeground)
                            .frame(maxWidth: .infinity)
                    } else if reviewDraft?.saved == true {
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
                .background(reviewDraft?.saved == true ? Color.Hakumi.success : Color.Hakumi.accent)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md))
                .disabled(reviewDraft?.isSaving == true || reviewDraft?.saved == true
                    || (reviewDraft?.title.trimmingCharacters(in: .whitespaces).isEmpty ?? true))
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
        EmptyStateView(
            icon: "bubble.left.and.bubble.right",
            title: "Start a conversation",
            subtitle: "Type a message below to get started."
        )
        .padding(.top, 80)
        .frame(maxHeight: nil)
    }

    private var searchEmptyState: some View {
        EmptyStateView(
            icon: "magnifyingglass",
            title: "No results for \"\(searchQuery ?? "")\""
        )
        .padding(.top, 80)
        .frame(maxHeight: nil)
    }

    // MARK: - Local actions

    private func openReviewSheet() {
        let assistantContent = lastAssistantContent
        let titleBase = vm.chatTitle == "Chat" || vm.chatTitle == "New conversation" ? "Note from conversation" : vm.chatTitle
        reviewDraft = ReviewDraft(
            title: String(titleBase.prefix(80)),
            content: String(assistantContent.prefix(2000))
        )
    }

    private func saveReview() async {
        guard var draft = reviewDraft else { return }
        draft.isSaving = true
        reviewDraft = draft
        let success = await vm.saveAsNote(title: draft.title, content: draft.content)
        reviewDraft?.isSaving = false
        if success {
            reviewDraft?.saved = true
            try? await Task.sleep(for: .seconds(1.2))
            reviewDraft = nil
        }
    }

    // MARK: - Helpers

    private func scrollToBottom(proxy: ScrollViewProxy) {
        withAnimation(.none) { proxy.scrollTo("chat-bottom", anchor: .bottom) }
    }

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
    }
    .environment(AppStores.shared)
    .environment(ComposerState.shared)
    .environment(Router())
}
