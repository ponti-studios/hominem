import React, { useCallback, useMemo, useRef } from 'react';
import { Alert, TextInput } from 'react-native';

import { InlineEnhanceTray } from '~/components/ai/InlineEnhanceTray';
import { ComposerAttachmentRow } from '~/components/composer/ComposerAttachmentRow';
import { ComposerProvider } from '~/components/composer/ComposerContext';
import { ComposerShell } from '~/components/composer/ComposerShell';
import { ComposerTextInput } from '~/components/composer/ComposerTextInput';
import { ComposerToolbar } from '~/components/composer/ComposerToolbar';
import { useComposerController } from '~/components/composer/useComposerController';
import { useActiveChat, useAutoUpdateChatTitle, useSendMessage } from '~/services/chat';
import {
  clearChatDraft,
  consumeChatComposerHandoff,
  readChatDraft,
  writeChatDraft,
} from '~/services/workspace/launch-state';
import t from '~/translations';

export interface ChatComposerContentProps {
  chatId: string;
  initialMessage?: string;
  testID?: string;
}

export function ChatComposerEntry({ chatId, initialMessage, testID }: ChatComposerContentProps) {
  const handoff = useMemo(() => consumeChatComposerHandoff(chatId), [chatId]);

  return (
    <ComposerProvider initialAttachments={handoff?.attachments ?? []}>
      <ChatComposerContent
        chatId={chatId}
        initialMessage={handoff?.message ?? initialMessage}
        testID={testID}
      />
    </ComposerProvider>
  );
}

function ChatComposerContent({ chatId, initialMessage, testID }: ChatComposerContentProps) {
  const { data: activeChat } = useActiveChat(chatId);
  const resolvedChatId = activeChat?.id ?? chatId;
  const persistedDraft = readChatDraft(resolvedChatId);
  const resolvedInitialMessage =
    persistedDraft.trim().length > 0 ? persistedDraft : (initialMessage ?? '');

  return (
    <ChatComposerDraftContent
      key={resolvedChatId}
      chatId={resolvedChatId}
      initialMessage={resolvedInitialMessage}
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
  const handleVoiceError = useCallback(
    (error: { title: string; message: string }) =>
      Alert.alert(error.title, error.message, [{ text: 'OK' }]),
    [],
  );
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
    isVoiceBusy,
    isCleaningVoice,
    isRecording,
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
    onVoiceError: handleVoiceError,
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
        isEnhanceOpen ? (
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
