import { useQueryClient } from '@tanstack/react-query';
import React, { useCallback, useRef } from 'react';
import { Alert, TextInput } from 'react-native';

import { InlineEnhanceTray } from '~/components/ai/InlineEnhanceTray';
import { ComposerAttachmentRow } from '~/components/composer/ComposerAttachmentRow';
import { ComposerShell } from '~/components/composer/ComposerShell';
import { ComposerTextInput } from '~/components/composer/ComposerTextInput';
import { ComposerToolbar } from '~/components/composer/ComposerToolbar';
import { useComposerController } from '~/components/composer/useComposerController';
import { normalizeChatTitle, useStartChatFromInbox } from '~/services/chat';
import { invalidateInboxQueries } from '~/services/inbox/inbox-refresh';
import { useTopAnchoredInbox } from '~/services/inbox/top-anchored-inbox';
import { donateAddNoteIntent } from '~/services/intent-donation';
import { useCreateNote } from '~/services/notes/use-create-note';
import t from '~/translations';

export interface InboxComposerContentProps {
  initialMessage?: string;
  onDraftChange?: (msg: string) => void;
  onClearDraft?: () => void;
  entryMode?: 'mixed' | 'note' | 'chat';
  onComplete?: () => void;
  testID?: string;
}

export function InboxComposerContent({
  initialMessage,
  onDraftChange,
  onClearDraft,
  entryMode = 'mixed',
  onComplete,
  testID,
}: InboxComposerContentProps) {
  const queryClient = useQueryClient();
  const { requestTopReveal } = useTopAnchoredInbox();
  const { mutateAsync: createNote, isPending: isSaving } = useCreateNote();
  const { startChat, isStartingChat } = useStartChatFromInbox();
  const inputRef = useRef<TextInput>(null);
  const isSubmitting = isSaving || isStartingChat;
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
    isSubmitting,
    onDraftChange,
    onClearDraft,
    onVoiceError: handleVoiceError,
  });

  const handleSave = useCallback(async () => {
    if (!canSubmit || isSaving) return;
    await createNote({ text: message.trim(), fileIds: uploadedAttachmentIds });
    donateAddNoteIntent();
    await invalidateInboxQueries(queryClient);
    requestTopReveal();
    clearComposer();
    onComplete?.();
  }, [
    canSubmit,
    isSaving,
    createNote,
    message,
    uploadedAttachmentIds,
    queryClient,
    requestTopReveal,
    clearComposer,
    onComplete,
  ]);

  const handleStartChat = useCallback(async () => {
    if (!canSubmit || isStartingChat) return;

    try {
      await startChat({
        title: normalizeChatTitle(message),
        message: message.trim(),
        fileIds: uploadedAttachmentIds,
        noteIds: [],
        onReady: () => {
          clearComposer();
          requestTopReveal();
          onComplete?.();
        },
      });
    } catch (error) {
      const message =
        error instanceof Error && error.message === 'offline_unavailable'
          ? 'You appear to be offline. Please reconnect and try again.'
          : 'We could not start that chat right now. Please try again.';
      Alert.alert('Could not start chat', message, [{ text: 'OK' }]);
    }
  }, [
    canSubmit,
    isStartingChat,
    startChat,
    message,
    uploadedAttachmentIds,
    clearComposer,
    requestTopReveal,
    onComplete,
  ]);

  const isChatEntryMode = entryMode === 'chat';
  const inputPlaceholder = isChatEntryMode
    ? t.chat.input.messagePlaceholder
    : t.inboxComposer.composer.placeholder;
  const shellTestId = testID ?? 'inbox-composer';
  const inputTestId = 'inbox-composer-input';
  const secondaryAction = isChatEntryMode
    ? {
        accessibilityLabel: t.inboxComposer.composer.saveNoteA11y,
        icon: 'doc.text' as const,
        onPress: () => void handleSave(),
        testID: 'composer-save-note',
      }
    : {
        accessibilityLabel: t.inboxComposer.composer.openChatA11y,
        icon: 'bubble.left' as const,
        onPress: () => void handleStartChat(),
        testID: 'composer-start-chat',
      };

  return (
    <ComposerShell
      testID={shellTestId}
      accessory={showAttachments ? <ComposerAttachmentRow /> : undefined}
      input={
        <ComposerTextInput
          inputRef={inputRef}
          value={message}
          onChangeText={setMessage}
          placeholder={inputPlaceholder}
          testID={inputTestId}
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
          mode="inbox"
          isRecording={isRecording}
          isVoiceBusy={isVoiceBusy}
          isEnhancing={isEnhancing}
          isCleaningVoice={isCleaningVoice}
          canPickMedia={canPickMedia}
          canToggleVoice={canToggleVoice}
          canEnhance={canOpenEnhance}
          canSubmit={canSubmit}
          isSubmitting={isSubmitting}
          onVoicePress={() => void handleVoicePress()}
          onEnhancePress={toggleEnhance}
          onSubmit={() => void (isChatEntryMode ? handleStartChat() : handleSave())}
          submitTestID={isChatEntryMode ? 'composer-submit-chat' : 'composer-submit-note'}
          submitAccessibilityLabel={
            isChatEntryMode ? t.inbox.screen.startChatSubmitA11y : t.inboxComposer.composer.saveNoteA11y
          }
          secondaryAction={secondaryAction}
        />
      }
    />
  );
}
