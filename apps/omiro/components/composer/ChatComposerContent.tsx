import React, { useCallback, useRef } from 'react';
import { TextInput } from 'react-native';

import { InlineEnhancePanel } from '~/components/ai/InlineEnhancePanel';
import { ComposerKit, useComposerController } from '~/components/composer';
import { ComposerAttachmentRow } from '~/components/composer/ComposerAttachmentRow';
import { ComposerProvider } from '~/components/composer/ComposerContext';
import { InlineErrorBanner } from '~/components/composer/InlineErrorBanner';
import { getVoiceComposerErrorPresentation } from '~/components/composer/voiceComposerInput.helpers';
import { VoiceRecordingPanel } from '~/components/composer/VoiceRecordingPanel';
import { useActiveChat, useAutoUpdateChatTitle, useSendMessage } from '~/services/chat';
import { clearChatDraft, readChatDraft, writeChatDraft } from '~/services/navigation/launch-state';
import t from '~/translations';

export interface ChatComposerContentProps {
  chatId: string;
  testID?: string;
}

export function ChatComposerEntry({ chatId, testID }: ChatComposerContentProps) {
  return (
    <ComposerProvider>
      <ChatComposerContent chatId={chatId} testID={testID} />
    </ComposerProvider>
  );
}

function ChatComposerContent({ chatId, testID }: ChatComposerContentProps) {
  const { data: activeChat } = useActiveChat(chatId);
  const resolvedChatId = activeChat?.id ?? chatId;
  const persistedDraft = readChatDraft(resolvedChatId);
  const inputRef = useRef<TextInput>(null);
  const { sendChatMessage, isChatSending } = useSendMessage({ chatId });
  const autoUpdateTitle = useAutoUpdateChatTitle(chatId);
  const {
    message,
    setMessage,
    showAttachments,
    uploadedAttachmentIds,
    canSubmit,
    canOpenEnhance,
    canPickMedia,
    canToggleVoice,
    voice,
    enhance,
    clearComposer,
    isColumnLayout,
    handleInputFocus,
    handleInputBlur,
  } = useComposerController({
    initialMessage: persistedDraft,
    isSubmitting: isChatSending,
    onDraftChange: (msg) => writeChatDraft(chatId, msg),
    onClearDraft: () => clearChatDraft(chatId),
  });

  const handleSend = useCallback(async () => {
    if (!canSubmit || isChatSending) return;
    const trimmedMessage = message.trim();
    await sendChatMessage({ message: trimmedMessage, fileIds: uploadedAttachmentIds, noteIds: [] });
    await autoUpdateTitle(trimmedMessage);
    clearComposer();
  }, [
    canSubmit,
    isChatSending,
    message,
    uploadedAttachmentIds,
    sendChatMessage,
    autoUpdateTitle,
    clearComposer,
  ]);

  return (
    <ComposerKit
      testID={testID ?? 'chat-composer'}
      isRecording={voice.isRecording}
      isColumnLayout={isColumnLayout}
      accessory={showAttachments ? <ComposerAttachmentRow /> : undefined}
      inlinePanel={
        voice.isRecording ? (
          <VoiceRecordingPanel
            startedAt={voice.recordingStartedAt}
            onCancel={() => void voice.cancelVoiceRecording()}
            onDone={() => void voice.handleVoicePress()}
          />
        ) : (
          <InlineEnhancePanel enhance={enhance} text={message} onEnhanced={setMessage} />
        )
      }
      errorBanner={
        voice.voiceState === 'failed' && voice.error ? (
          <InlineErrorBanner
            message={getVoiceComposerErrorPresentation(voice.error.code).message}
            onDismiss={voice.clearError}
          />
        ) : undefined
      }
    >
      <ComposerKit.Input
        inputRef={inputRef}
        value={message}
        onChangeText={setMessage}
        placeholder={t.chat.input.messagePlaceholder}
        testID="chat-composer-input"
        isColumnLayout={isColumnLayout}
        onFocus={handleInputFocus}
        onBlur={handleInputBlur}
      />
      <ComposerKit.Toolbar
        mode="chat"
        isRecording={voice.isRecording}
        isRecordingElsewhere={voice.isRecordingElsewhere}
        isVoiceBusy={voice.isBusy}
        isEnhancing={enhance.isEnhancing}
        isCleaningVoice={voice.isCleaningVoice}
        canPickMedia={canPickMedia}
        canToggleVoice={canToggleVoice}
        canEnhance={canOpenEnhance}
        canSubmit={canSubmit}
        isSubmitting={isChatSending}
        onVoicePress={() => void voice.handleVoicePress()}
        onEnhancePress={enhance.toggleEnhance}
        onSubmit={() => void handleSend()}
      />
    </ComposerKit>
  );
}
