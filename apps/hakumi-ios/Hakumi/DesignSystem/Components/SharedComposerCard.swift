import SwiftUI
import PhotosUI
import UIKit
import UniformTypeIdentifiers

// MARK: - SharedComposerCard
//
// Floating composer card rendered by each tab's NavigationStack via
// `.safeAreaInset(edge: .bottom)`. It reads from and writes to
// `ComposerState.shared`, so draft text and selected notes survive
// navigation transitions.

struct SharedComposerCard: View {
    @Environment(Router.self) private var router
    let target: ComposerState.Target

    private var state: ComposerState { ComposerState.shared }

    @State private var isSending = false
    @FocusState private var isInputFocused: Bool
    @State private var pickerItems: [PhotosPickerItem] = []
    @State private var isAttachmentUploading = false
    @State private var uploadErrorMessage: String? = nil

    var body: some View {
        VStack(spacing: Spacing.xs) {
            // Note mention suggestions dropdown (above card)
            if !state.mentionResults.isEmpty {
                mentionSuggestions
                    .transition(.asymmetric(
                        insertion: .move(edge: .bottom).combined(with: .opacity),
                        removal: .opacity
                    ))
            }

            // Submit error banner (above card)
            if let error = state.submitError {
                submitErrorBanner(message: error)
                    .transition(.asymmetric(
                        insertion: .move(edge: .bottom).combined(with: .opacity),
                        removal: .opacity
                    ))
            }

            // Upload error banner
            if let error = uploadErrorMessage {
                uploadErrorBanner(message: error)
                    .transition(.asymmetric(
                        insertion: .move(edge: .bottom).combined(with: .opacity),
                        removal: .opacity
                    ))
            }

            // Voice permission error banner
            if VoiceRecordingService.shared.permissionError != nil {
                voicePermissionBanner
                    .transition(.asymmetric(
                        insertion: .move(edge: .bottom).combined(with: .opacity),
                        removal: .opacity
                    ))
            }

            card
        }
        .padding(.horizontal, Spacing.md)
        .padding(.bottom, Spacing.xs)
        .animation(Motion.spring, value: state.submitError)
        .animation(Motion.spring, value: uploadErrorMessage)
    }

    // MARK: - Card

    private var card: some View {
        VStack(spacing: Spacing.xs) {
            // Note selection chips
            if !state.selectedNotes.isEmpty {
                selectionChips
            }

            // Attachment chips
            if !state.attachments.isEmpty {
                attachmentChips
            }

            // Text input row (replaced by waveform row during voice recording)
            if state.isRecording {
                voiceRecordingRow
                    .transition(.asymmetric(
                        insertion: .opacity.combined(with: .offset(y: 4)),
                        removal: .opacity
                    ))
            } else {
                inputRow
                    .transition(.asymmetric(
                        insertion: .opacity.combined(with: .offset(y: -4)),
                        removal: .opacity
                    ))
            }

            // Accessory row
            accessoryRow
        }
        .padding(.horizontal, Spacing.sm2)
        .padding(.top, Spacing.sm2)
        .padding(.bottom, Spacing.md)
        .background(Color.Hakumi.bgElevated)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .strokeBorder(Color.Hakumi.borderDefault, lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.22), radius: 16, x: 0, y: 6)
        .animation(Motion.spring, value: state.isRecording)
    }

    // MARK: - Voice recording row

    private var voiceRecordingRow: some View {
        HStack(spacing: Spacing.sm) {
            WaveformView(amplitude: VoiceRecordingService.shared.amplitude)
                .frame(maxWidth: .infinity)

            Text(state.draftText.isEmpty
                 ? "Listening…"
                 : state.draftText)
                .font(.system(size: 14))
                .foregroundStyle(Color.Hakumi.textSecondary)
                .lineLimit(2)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(minHeight: 36)
        .padding(.horizontal, Spacing.xs)
        .animation(.easeInOut(duration: 0.15), value: VoiceRecordingService.shared.amplitude)
    }

    // MARK: - Input row

    private var inputRow: some View {
        TextField(target.placeholder, text: Binding(
            get: { state.draftText },
            set: { state.draftText = $0 }
        ), axis: .vertical)
        .font(.system(size: 15))
        .foregroundStyle(Color.Hakumi.textPrimary)
        .lineLimit(1...5)
        .focused($isInputFocused)
        .padding(.horizontal, Spacing.xs)
        .tint(Color.Hakumi.accent)
        .accessibilityIdentifier("composer.textField")
    }

    // MARK: - Accessory row

    private var accessoryRow: some View {
        HStack(spacing: Spacing.sm) {
            // Left: attachment picker
            PhotosPicker(
                selection: $pickerItems,
                maxSelectionCount: max(1, FileUploadService.maxFileCount - state.attachments.count),
                matching: .images
            ) {
                Group {
                    if isAttachmentUploading {
                        ProgressView()
                            .tint(Color.Hakumi.accent)
                            .scaleEffect(0.7)
                    } else {
                        Image(systemName: "plus")
                            .font(.system(size: 16, weight: .medium))
                            .foregroundStyle(Color.Hakumi.textSecondary)
                    }
                }
                .frame(width: 28, height: 28)
                .background(Color.Hakumi.bgSurface)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            }
            .disabled(isAttachmentUploading || state.attachments.count >= FileUploadService.maxFileCount)
            .onChange(of: pickerItems) { _, items in
                guard !items.isEmpty else { return }
                pickerItems = []
                Task { await handlePickedItems(items) }
            }
            .accessibilityLabel("Add attachment")

            // Voice input button
            Button {
                isInputFocused = false
                if state.isRecording {
                    state.stopVoiceInput()
                } else {
                    Task { await state.startVoiceInput() }
                }
            } label: {
                Image(systemName: state.isRecording ? "stop.fill" : "waveform")
                    .font(.system(size: 15))
                    .foregroundStyle(state.isRecording
                        ? Color.red
                        : Color.Hakumi.textSecondary)
                    .frame(width: 28, height: 28)
                    .background(state.isRecording
                        ? Color.red.opacity(0.12)
                        : Color.Hakumi.bgSurface)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            }
            .accessibilityLabel(state.isRecording ? "Stop recording" : "Voice input")

            Spacer()

            // Secondary action: "Start chat" (feed only)
            if target.hasSecondaryAction {
                Button {
                    isInputFocused = false
                    isSending = true
                    Task {
                        await state.submitSecondary(router: router)
                        isSending = false
                    }
                } label: {
                    Image(systemName: "bubble.left")
                        .font(.system(size: 15))
                        .foregroundStyle(state.canSubmit
                            ? Color.Hakumi.textSecondary
                            : Color.Hakumi.textDisabled)
                        .frame(width: 32, height: 32)
                        .background(Color.Hakumi.bgSurface)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                                .strokeBorder(Color.Hakumi.borderSubtle, lineWidth: 1)
                        )
                }
                .disabled(!state.canSubmit || isSending)
                .accessibilityLabel("Start chat")
            }

            // Primary send / save button
            Button {
                isInputFocused = false
                isSending = true
                Task {
                    await state.submitPrimary(router: router)
                    isSending = false
                }
            } label: {
                Group {
                    if isSending {
                        ProgressView()
                            .tint(Color.Hakumi.bgBase)
                            .scaleEffect(0.75)
                    } else {
                        Image(systemName: "arrow.up")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(state.canSubmit
                                ? Color.Hakumi.bgBase
                                : Color.Hakumi.textDisabled)
                    }
                }
                .frame(width: 32, height: 32)
                .background(state.canSubmit
                    ? Color.Hakumi.foreground
                    : Color.Hakumi.bgSurface)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .strokeBorder(Color.Hakumi.borderSubtle, lineWidth: 1)
                        .opacity(state.canSubmit ? 0 : 1)
                )
            }
            .disabled(!state.canSubmit || isSending)
            .accessibilityLabel(isSending ? "Sending…" : target.primaryLabel)
            .accessibilityIdentifier("composer.sendButton")
        }
    }

    // MARK: - Selection chips

    private var selectionChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Spacing.sm) {
                ForEach(state.selectedNotes) { note in
                    HStack(spacing: Spacing.xs) {
                        Image(systemName: "bubble.left")
                            .font(.system(size: 11))
                            .foregroundStyle(Color.Hakumi.textSecondary)
                        Text(note.displayTitle)
                            .font(.system(size: 12))
                            .foregroundStyle(Color.Hakumi.textSecondary)
                            .lineLimit(1)
                        Button {
                            withAnimation(Motion.spring) {
                                state.removeNote(id: note.id)
                            }
                        } label: {
                            Image(systemName: "xmark")
                                .font(.system(size: 10, weight: .semibold))
                                .foregroundStyle(Color.Hakumi.textTertiary)
                        }
                        .accessibilityLabel("Remove \(note.displayTitle)")
                    }
                    .padding(.horizontal, Spacing.sm)
                    .padding(.vertical, Spacing.xs)
                    .background(Color.Hakumi.bgSurface)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                            .strokeBorder(Color.Hakumi.borderDefault, lineWidth: 1)
                    )
                    .transition(.asymmetric(
                        insertion: .scale.combined(with: .opacity),
                        removal: .scale.combined(with: .opacity)
                    ))
                }
            }
            .padding(.horizontal, Spacing.xs)
        }
    }

    // MARK: - Attachment chips

    private var attachmentChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Spacing.sm) {
                ForEach(state.attachments) { attachment in
                    HStack(spacing: Spacing.xs) {
                        Image(systemName: attachment.systemIcon)
                            .font(.system(size: 11))
                            .foregroundStyle(Color.Hakumi.textSecondary)
                        Text(attachment.name)
                            .font(.system(size: 12))
                            .foregroundStyle(Color.Hakumi.textSecondary)
                            .lineLimit(1)
                        Button {
                            withAnimation(Motion.spring) {
                                state.removeAttachment(id: attachment.id)
                            }
                        } label: {
                            Image(systemName: "xmark")
                                .font(.system(size: 10, weight: .semibold))
                                .foregroundStyle(Color.Hakumi.textTertiary)
                        }
                        .accessibilityLabel("Remove \(attachment.name)")
                    }
                    .padding(.horizontal, Spacing.sm)
                    .padding(.vertical, Spacing.xs)
                    .background(Color.Hakumi.bgSurface)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                            .strokeBorder(Color.Hakumi.borderDefault, lineWidth: 1)
                    )
                    .transition(.asymmetric(
                        insertion: .scale.combined(with: .opacity),
                        removal: .scale.combined(with: .opacity)
                    ))
                }
            }
            .padding(.horizontal, Spacing.xs)
        }
    }

    // MARK: - Attachment upload handler

    private func handlePickedItems(_ items: [PhotosPickerItem]) async {
        isAttachmentUploading = true
        var failedCount = 0

        for item in items {
            guard let rawData = try? await item.loadTransferable(type: Data.self) else {
                failedCount += 1
                continue
            }

            let uploadData: Data
            let mimeType: String
            let preferredMIME = item.supportedContentTypes.first?.preferredMIMEType ?? ""

            if FileUploadService.allowedMIMETypes.contains(preferredMIME) {
                uploadData = rawData
                mimeType = preferredMIME
            } else if let img = UIImage(data: rawData),
                      let jpegData = img.jpegData(compressionQuality: 0.8) {
                uploadData = jpegData
                mimeType = "image/jpeg"
            } else {
                failedCount += 1
                continue
            }

            let ext = UTType(mimeType: mimeType)?.preferredFilenameExtension ?? "jpg"
            let fileName = "photo-\(Int(Date().timeIntervalSince1970)).\(ext)"

            if let result = try? await FileUploadService.shared.uploadFile(
                data: uploadData,
                fileName: fileName,
                mimeType: mimeType
            ) {
                let attachment = ComposerAttachment(
                    id: result.id,
                    name: result.originalName,
                    mimeType: result.mimeType,
                    url: result.url
                )
                state.addAttachment(attachment)
            } else {
                failedCount += 1
            }
        }

        isAttachmentUploading = false

        if failedCount > 0 {
            let noun = failedCount == 1 ? "attachment" : "attachments"
            uploadErrorMessage = "Failed to upload \(failedCount) \(noun) — try again"
        }
    }

    // MARK: - Error banners

    private func submitErrorBanner(message: String) -> some View {
        Button {
            isSending = true
            Task {
                await state.submitPrimary(router: router)
                isSending = false
            }
        } label: {
            HStack(spacing: Spacing.sm) {
                Image(systemName: "exclamationmark.circle.fill")
                    .font(.system(size: 13))
                Text(message)
                    .font(.system(size: 13))
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .foregroundStyle(.white)
            .padding(.horizontal, Spacing.md)
            .padding(.vertical, Spacing.sm)
            .background(Color.red.opacity(0.85))
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        }
        .disabled(isSending)
    }

    private func uploadErrorBanner(message: String) -> some View {
        HStack(spacing: Spacing.sm) {
            Image(systemName: "exclamationmark.circle.fill")
                .font(.system(size: 13))
            Text(message)
                .font(.system(size: 13))
                .frame(maxWidth: .infinity, alignment: .leading)
            Button {
                uploadErrorMessage = nil
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 11, weight: .semibold))
            }
        }
        .foregroundStyle(.white)
        .padding(.horizontal, Spacing.md)
        .padding(.vertical, Spacing.sm)
        .background(Color.red.opacity(0.85))
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
    }

    // MARK: - Permission error (voice)

    private var voicePermissionBanner: some View {
        HStack(spacing: Spacing.sm) {
            Image(systemName: "mic.slash.fill").font(.system(size: 13))
            Text(VoiceRecordingService.shared.permissionError ?? "")
                .font(.system(size: 13))
                .frame(maxWidth: .infinity, alignment: .leading)
            Button { } label: {
                Image(systemName: "xmark").font(.system(size: 11, weight: .semibold))
            }
        }
        .foregroundStyle(.white)
        .padding(.horizontal, Spacing.md)
        .padding(.vertical, Spacing.sm)
        .background(Color.red.opacity(0.85))
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
    }

    // MARK: - Mention suggestions

    private var mentionSuggestions: some View {
        VStack(spacing: 0) {
            ForEach(state.mentionResults) { note in
                Button {
                    withAnimation(Motion.spring) {
                        state.addNote(note)
                    }
                } label: {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(note.displayTitle)
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(Color.Hakumi.textPrimary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, Spacing.md)
                    .padding(.vertical, Spacing.sm)
                }
                .accessibilityLabel("Link note: \(note.displayTitle)")

                if note.id != state.mentionResults.last?.id {
                    Divider().background(Color.Hakumi.borderFaint)
                }
            }
        }
        .background(Color.Hakumi.bgSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .strokeBorder(Color.Hakumi.borderDefault, lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.14), radius: 8, x: 0, y: 2)
    }
}
