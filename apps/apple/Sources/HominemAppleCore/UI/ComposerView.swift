import PhotosUI
import SwiftUI

/// Reusable message composer bar.
///
/// Replaces `apps/mobile/components/input/mobile-composer.tsx`.
/// Features: multi-line text input, photo attachment via `PhotosPicker`,
/// voice recording button (toggles `AudioRecorder`), send button.
///
/// The caller owns the `AudioRecorder` and `VoiceService` instances so they
/// can be shared with the parent screen.
public struct ComposerView: View {
    // MARK: Bindings / callbacks

    @Binding var text: String
    let isSending: Bool
    let onSend: () async -> Void
    let onAttach: ((PhotosPickerItem) async -> Void)?

    // MARK: Audio

    var audioRecorder: AudioRecorder
    let voiceService: VoiceService?

    // MARK: Internal state

    @State private var selectedPhoto: PhotosPickerItem?
    @State private var isTranscribing = false
    @State private var isDragTargeted = false
    @FocusState private var textFocused: Bool

    public init(
        text: Binding<String>,
        isSending: Bool,
        audioRecorder: AudioRecorder,
        voiceService: VoiceService? = nil,
        onSend: @escaping () async -> Void,
        onAttach: ((PhotosPickerItem) async -> Void)? = nil
    ) {
        self._text = text
        self.isSending = isSending
        self.audioRecorder = audioRecorder
        self.voiceService = voiceService
        self.onSend = onSend
        self.onAttach = onAttach
    }

    private var canSend: Bool {
        text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false && !isSending
    }

    private var isRecording: Bool { audioRecorder.state == .recording }

    public var body: some View {
        VStack(spacing: 0) {
            audioStatusBar
            composerRow
        }
        .background(AppleTheme.background)
        .onChange(of: selectedPhoto) { _, item in
            guard let item, let onAttach else { return }
            selectedPhoto = nil
            Task { await onAttach(item) }
        }
    }

    // MARK: - Audio status bar

    @ViewBuilder
    private var audioStatusBar: some View {
        switch audioRecorder.state {
        case .recording:
            HStack(spacing: AppleTheme.sm) {
                Circle()
                    .fill(AppleTheme.destructive)
                    .frame(width: 8, height: 8)
                    .opacity(0.8)
                Text("Recording…")
                    .font(AppleTheme.captionFont)
                    .foregroundStyle(AppleTheme.destructive)
                Spacer()
                Button("Cancel") { audioRecorder.cancel() }
                    .font(AppleTheme.captionFont)
                    .foregroundStyle(AppleTheme.secondaryText)
            }
            .padding(.horizontal, AppleTheme.md)
            .padding(.vertical, AppleTheme.xs)
            .background(AppleTheme.destructive.opacity(0.06))
        case .transcribing:
            HStack(spacing: AppleTheme.sm) {
                ProgressView().scaleEffect(0.7)
                Text("Transcribing…")
                    .font(AppleTheme.captionFont)
                    .foregroundStyle(AppleTheme.secondaryText)
                Spacer()
            }
            .padding(.horizontal, AppleTheme.md)
            .padding(.vertical, AppleTheme.xs)
            .background(AppleTheme.surface)
        case .failed(let msg):
            HStack(spacing: AppleTheme.sm) {
                Image(systemName: "exclamationmark.triangle")
                    .foregroundStyle(AppleTheme.destructive)
                Text(msg)
                    .font(AppleTheme.captionFont)
                    .foregroundStyle(AppleTheme.destructive)
                    .lineLimit(1)
                Spacer()
                Button("Dismiss") { audioRecorder.clearError() }
                    .font(AppleTheme.captionFont)
                    .foregroundStyle(AppleTheme.secondaryText)
            }
            .padding(.horizontal, AppleTheme.md)
            .padding(.vertical, AppleTheme.xs)
            .background(AppleTheme.destructive.opacity(0.06))
        default:
            EmptyView()
        }
    }

    // MARK: - Composer row

    private var composerRow: some View {
        HStack(alignment: .bottom, spacing: AppleTheme.sm) {
            // Attachment picker (iOS-only — PhotosPicker not available on macOS 13)
            if onAttach != nil {
                PhotosPicker(
                    selection: $selectedPhoto,
                    matching: .images,
                    photoLibrary: .shared()
                ) {
                    Image(systemName: "paperclip")
                        .font(.system(size: 20))
                        .foregroundStyle(AppleTheme.secondaryText)
                        .frame(width: 36, height: 36)
                }
                .buttonStyle(.plain)
            }

            // Mic button
            if voiceService != nil {
                micButton
            }

            // Text input
            TextField("Message", text: $text, axis: .vertical)
                .lineLimit(1...6)
                .padding(.horizontal, AppleTheme.sm12)
                .padding(.vertical, AppleTheme.sm)
                .background(isDragTargeted ? AppleTheme.accent.opacity(0.08) : AppleTheme.surface)
                .clipShape(RoundedRectangle(cornerRadius: AppleTheme.controlRadius, style: .continuous))
                .focused($textFocused)
                .dropDestination(for: String.self) { items, _ in
                    let dropped = items.joined(separator: "\n")
                    guard dropped.isEmpty == false else { return false }
                    text += (text.isEmpty ? "" : "\n") + dropped
                    return true
                } isTargeted: { isDragTargeted = $0 }

            // Send button
            sendButton
        }
        .padding(.horizontal, AppleTheme.md)
        .padding(.vertical, AppleTheme.sm12)
    }

    // MARK: - Mic button

    private var micButton: some View {
        Button {
            Task { await toggleRecording() }
        } label: {
            Image(systemName: isRecording ? "stop.circle.fill" : "mic")
                .font(.system(size: 20))
                .foregroundStyle(isRecording ? AppleTheme.destructive : AppleTheme.secondaryText)
                .frame(width: 36, height: 36)
                .animation(.easeInOut(duration: 0.15), value: isRecording)
        }
        .buttonStyle(.plain)
        .disabled(audioRecorder.state == .transcribing || audioRecorder.state == .stopping)
    }

    // MARK: - Send button

    private var sendButton: some View {
        Button {
            Task { await onSend() }
        } label: {
            Image(systemName: "arrow.up.circle.fill")
                .font(.system(size: 30))
                .foregroundStyle(canSend ? AppleTheme.accent : AppleTheme.border)
                .animation(.easeInOut(duration: 0.1), value: canSend)
        }
        .buttonStyle(.plain)
        .disabled(!canSend)
    }

    // MARK: - Toggle recording

    private func toggleRecording() async {
        guard let voiceService else { return }

        if isRecording {
            do {
                let transcript = try await audioRecorder.stopAndTranscribe(using: voiceService)
                if transcript.isEmpty == false {
                    text += (text.isEmpty ? "" : " ") + transcript
                    textFocused = true
                }
            } catch {
                // Error is shown in audioStatusBar via audioRecorder.state
            }
        } else {
            textFocused = false
            await audioRecorder.startRecording()
        }
    }
}
