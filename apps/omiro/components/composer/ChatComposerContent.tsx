import React, { useCallback, useRef } from 'react';
import { TextInput } from 'react-native';

import { InlineEnhanceTray } from '~/components/ai/InlineEnhanceTray';
import { ComposerAttachmentRow } from '~/components/composer/ComposerAttachmentRow';
import { ComposerProvider } from '~/components/composer/ComposerContext';
import { ComposerShell } from '~/components/composer/ComposerShell';
import { ComposerTextInput } from '~/components/composer/ComposerTextInput';
import { ComposerToolbar } from '~/components/composer/ComposerToolbar';
import { InlineErrorBanner } from '~/components/composer/InlineErrorBanner';
import { useComposerController } from '~/components/composer/useComposerController';
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

  return (
    <ChatComposerDraftContent
      key={resolvedChatId}
      chatId={resolvedChatId}
      initialMessage={persistedDraft}
      testID={testID}
    />
  );
}

interface ChatComposerDraftContentProps {
  chatId: string;
  initialMessage: string;
  testID?: string;
}

function ChatComposerDraftContent({
  chatId,
  initialMessage,
  testID,
}: ChatComposerDraftContentProps) {
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
    handleVoicePress,
    cancelVoiceRecording,
    isVoiceBusy,
    isCleaningVoice,
    isRecording,
    isRecordingElsewhere,
    recordingStartedAt,
    voiceState,
    voiceError,
    clearVoiceError,
    isEnhanceOpen,
    enhanceInstruction,
    setEnhanceInstruction,
    enhanceError,
    isEnhancing,
    toggleEnhance,
    closeEnhance,
    runEnhance,
    clearComposer,
  } = useComposerController({
    initialMessage,
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
    <ComposerShell
      testID={testID ?? 'chat-composer'}
      isRecording={isRecording}
      accessory={showAttachments ? <ComposerAttachmentRow /> : undefined}
      input={
        <ComposerTextInput
          inputRef={inputRef}
          value={message}
          onChangeText={setMessage}
          placeholder={t.chat.input.messagePlaceholder}
          testID="chat-composer-input"
        />
      }
      inlinePanel={
        isRecording ? (
          <VoiceRecordingPanel
            startedAt={recordingStartedAt}
            onCancel={() => void cancelVoiceRecording()}
            onDone={() => void handleVoicePress()}
          />
        ) : voiceState === 'failed' && voiceError ? (
          <InlineErrorBanner
            message={getVoiceComposerErrorPresentation(voiceError.code).message}
            onDismiss={clearVoiceError}
          />
        ) : isEnhanceOpen ? (
          <InlineEnhanceTray
            instruction={enhanceInstruction}
            onInstructionChange={setEnhanceInstruction}
            onCancel={closeEnhance}
            onConfirm={() =>
              void runEnhance({
                text: message,
                onEnhanced: setMessage,
              })
            }
            isEnhancing={isEnhancing}
            error={enhanceError}
          />
        ) : undefined
      }
      toolbar={
        <ComposerToolbar
          mode="chat"
          isRecording={isRecording}
          isRecordingElsewhere={isRecordingElsewhere}
          isVoiceBusy={isVoiceBusy}
          isEnhancing={isEnhancing}
          isCleaningVoice={isCleaningVoice}
          canPickMedia={canPickMedia}
          canToggleVoice={canToggleVoice}
          canEnhance={canOpenEnhance}
          canSubmit={canSubmit}
          isSubmitting={isChatSending}
          onVoicePress={() => void handleVoicePress()}
          onEnhancePress={toggleEnhance}
          onSubmit={() => void handleSend()}
        />
      }
    />
  );
}
