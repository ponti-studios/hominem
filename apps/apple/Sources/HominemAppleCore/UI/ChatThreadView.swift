import SwiftUI

/// Full chat thread — message list + `ComposerView`.
///
/// Mirrors `apps/mobile/app/(protected)/(tabs)/chat/[id].tsx`.
public struct ChatThreadView: View {
    let chat: Chat
    var chatsStore: ChatsStore
    let voiceService: VoiceService?
    let ttsPlayer: TTSPlayer?

    @State private var messageInput = ""
    @State private var errorMessage: String?
    @State private var audioRecorder = AudioRecorder()

    public init(
        chat: Chat,
        chatsStore: ChatsStore,
        voiceService: VoiceService? = nil,
        ttsPlayer: TTSPlayer? = nil
    ) {
        self.chat = chat
        self.chatsStore = chatsStore
        self.voiceService = voiceService
        self.ttsPlayer = ttsPlayer
    }

    private var messages: [ChatMessage] {
        guard chatsStore.activeChatId == chat.id else { return [] }
        return chatsStore.activeThread
    }

    public var body: some View {
        VStack(spacing: 0) {
            messageList
            Divider()
            ComposerView(
                text: $messageInput,
                isSending: chatsStore.isSending,
                audioRecorder: audioRecorder,
                voiceService: voiceService,
                onSend: { await sendMessage() }
            )
        }
        .navigationTitle(chat.title)
        .safeAreaInset(edge: .bottom, spacing: 0) { Color.clear.frame(height: 0) }
        .task {
            try? await chatsStore.loadThread(chatId: chat.id)
        }
        .onDisappear {
            audioRecorder.cancel()
            chatsStore.clearThread()
        }
    }

    // MARK: - Message list

    private var messageList: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: AppleTheme.sm) {
                    if messages.isEmpty && !chatsStore.isLoading {
                        emptyState
                    }

                    ForEach(messages) { message in
                        MessageBubble(message: message, ttsPlayer: ttsPlayer)
                            .id(message.id)
                    }

                    if chatsStore.isSending {
                        TypingIndicator()
                            .id("typing")
                    }

                    if let errorMessage {
                        Text(errorMessage)
                            .font(AppleTheme.captionFont)
                            .foregroundStyle(AppleTheme.destructive)
                            .padding(.horizontal, AppleTheme.md)
                    }
                }
                .padding(AppleTheme.md)
            }
            .onChange(of: messages.count) { _, _ in
                withAnimation(.easeOut(duration: 0.2)) {
                    proxy.scrollTo(
                        chatsStore.isSending ? "typing" : messages.last?.id,
                        anchor: .bottom
                    )
                }
            }
            .onChange(of: chatsStore.isSending) { _, sending in
                if sending {
                    withAnimation(.easeOut(duration: 0.2)) {
                        proxy.scrollTo("typing", anchor: .bottom)
                    }
                }
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: AppleTheme.sm) {
            Image(systemName: "bubble.left.and.bubble.right")
                .font(.largeTitle)
                .foregroundStyle(AppleTheme.tertiaryText)
            Text("Start the conversation")
                .font(AppleTheme.bodyFont)
                .foregroundStyle(AppleTheme.secondaryText)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, AppleTheme.xl)
    }

    // MARK: - Send

    private func sendMessage() async {
        let text = messageInput.trimmingCharacters(in: .whitespacesAndNewlines)
        guard text.isEmpty == false else { return }
        messageInput = ""
        errorMessage = nil

        do {
            _ = try await chatsStore.sendMessage(chatId: chat.id, message: text)
        } catch {
            errorMessage = error.localizedDescription
            messageInput = text
        }
    }
}

// MARK: - MessageBubble

private struct MessageBubble: View {
    let message: ChatMessage
    let ttsPlayer: TTSPlayer?

    private var isUser: Bool { message.role == .user }

    var body: some View {
        HStack(alignment: .bottom, spacing: 0) {
            if isUser { Spacer(minLength: 60) }

            VStack(alignment: isUser ? .trailing : .leading, spacing: AppleTheme.xs) {
                HStack(spacing: AppleTheme.xs) {
                    Text(isUser ? "You" : "Hominem")
                        .font(.caption2)
                        .foregroundStyle(AppleTheme.tertiaryText)
                        .padding(.horizontal, 4)

                    // TTS speak button for assistant messages
                    if !isUser, let ttsPlayer {
                        TTSSpeakButton(text: message.content, ttsPlayer: ttsPlayer)
                    }
                }

                Text(message.content)
                    .font(AppleTheme.bodyFont)
                    .foregroundStyle(isUser ? .white : AppleTheme.foreground)
                    .padding(.horizontal, AppleTheme.sm12)
                    .padding(.vertical, AppleTheme.sm)
                    .background(isUser ? AppleTheme.accent : AppleTheme.surface)
                    .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            }

            if !isUser { Spacer(minLength: 60) }
        }
    }
}

// MARK: - TTSSpeakButton

private struct TTSSpeakButton: View {
    let text: String
    let ttsPlayer: TTSPlayer

    private var isPlayingThis: Bool {
        ttsPlayer.currentText == text && ttsPlayer.state == .playing
    }

    private var isLoading: Bool {
        ttsPlayer.currentText == text && ttsPlayer.state == .loading
    }

    var body: some View {
        Button {
            Task { await ttsPlayer.toggle(text) }
        } label: {
            if isLoading {
                ProgressView().scaleEffect(0.5).frame(width: 14, height: 14)
            } else {
                Image(systemName: isPlayingThis ? "stop.circle" : "speaker.wave.2")
                    .font(.system(size: 11))
                    .foregroundStyle(AppleTheme.tertiaryText)
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(isPlayingThis ? "Stop speaking" : "Speak message")
    }
}

// MARK: - TypingIndicator

private struct TypingIndicator: View {
    @State private var animating = false

    var body: some View {
        HStack(spacing: 5) {
            ForEach(0..<3, id: \.self) { i in
                Circle()
                    .fill(AppleTheme.tertiaryText)
                    .frame(width: 8, height: 8)
                    .scaleEffect(animating ? 1.3 : 0.8)
                    .animation(
                        .easeInOut(duration: 0.5)
                            .repeatForever()
                            .delay(Double(i) * 0.15),
                        value: animating
                    )
            }
        }
        .padding(.horizontal, AppleTheme.sm12)
        .padding(.vertical, AppleTheme.sm)
        .background(AppleTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .onAppear { animating = true }
    }
}
