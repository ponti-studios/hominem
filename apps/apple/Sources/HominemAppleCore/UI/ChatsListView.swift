import SwiftUI

/// List of chat sessions. Tapping one pushes `ChatThreadView`.
///
/// Replaces the Chat tab placeholder in `ContentView`.
public struct ChatsListView: View {
    var chatsStore: ChatsStore
    let voiceService: VoiceService?
    let ttsPlayer: TTSPlayer?

    @State private var showingNewChat = false
    @State private var newChatTitle = ""
    @State private var isCreating = false

    public init(
        chatsStore: ChatsStore,
        voiceService: VoiceService? = nil,
        ttsPlayer: TTSPlayer? = nil
    ) {
        self.chatsStore = chatsStore
        self.voiceService = voiceService
        self.ttsPlayer = ttsPlayer
    }

    public var body: some View {
        List {
            ForEach(chatsStore.chats) { chat in
                NavigationLink {
                    ChatThreadView(
                        chat: chat,
                        chatsStore: chatsStore,
                        voiceService: voiceService,
                        ttsPlayer: ttsPlayer
                    )
                } label: {
                    ChatRow(chat: chat)
                        .listRowInsets(EdgeInsets(
                            top: AppleTheme.sm,
                            leading: AppleTheme.md,
                            bottom: AppleTheme.sm,
                            trailing: AppleTheme.md
                        ))
                }
                .listRowSeparator(.hidden)
            }
        }
        .listStyle(.plain)
        .navigationTitle("Chat")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    showingNewChat = true
                } label: {
                    Image(systemName: "square.and.pencil")
                }
            }
        }
        .overlay {
            if chatsStore.isLoading && chatsStore.chats.isEmpty {
                ProgressView()
            } else if chatsStore.chats.isEmpty && !chatsStore.isLoading {
                ContentUnavailableView(
                    "No Chats",
                    systemImage: "bubble.left.and.bubble.right",
                    description: Text("Tap + to start a conversation.")
                )
            }
        }
        .refreshable {
            await chatsStore.refresh()
        }
        .task {
            if chatsStore.chats.isEmpty {
                await chatsStore.refresh()
            }
        }
        .sheet(isPresented: $showingNewChat) {
            newChatSheet
        }
        .onReceive(NotificationCenter.default.publisher(for: .hominemNewChat)) { _ in
            showingNewChat = true
        }
    }

    // MARK: - New chat sheet

    private var newChatSheet: some View {
        NavigationStack {
            Form {
                Section("Chat Title") {
                    TextField("What do you want to explore?", text: $newChatTitle)
                        .autocorrectionDisabled()
                }
            }
            .navigationTitle("New Chat")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        newChatTitle = ""
                        showingNewChat = false
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") {
                        Task { await createChat() }
                    }
                    .disabled(newChatTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isCreating)
                }
            }
        }
        #if os(iOS)
        .presentationDetents([.medium])
        #endif
    }

    private func createChat() async {
        let title = newChatTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        guard title.isEmpty == false else { return }
        isCreating = true
        defer { isCreating = false }
        do {
            _ = try await chatsStore.createChat(title: title)
            newChatTitle = ""
            showingNewChat = false
        } catch {
            // Error is visible in the store
        }
    }
}

// MARK: - ChatRow

private struct ChatRow: View {
    let chat: Chat

    var body: some View {
        VStack(alignment: .leading, spacing: AppleTheme.xs) {
            Text(chat.title)
                .font(AppleTheme.bodyStrongFont)
                .foregroundStyle(AppleTheme.foreground)
                .lineLimit(1)

            Text(chat.relativeDate)
                .font(AppleTheme.monoCaptionFont)
                .foregroundStyle(AppleTheme.tertiaryText)
        }
        .padding(AppleTheme.sm12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AppleTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: AppleTheme.cardRadius, style: .continuous))
    }
}

// MARK: - Chat date helper

extension Chat {
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
