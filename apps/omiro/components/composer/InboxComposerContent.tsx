import { useQueryClient } from '@tanstack/react-query';
import React, { useCallback, useRef } from 'react';
import { Alert, TextInput } from 'react-native';

import { InlineEnhancePanel } from '~/components/ai/InlineEnhancePanel';
import { ComposerAttachmentRow } from '~/components/composer/ComposerAttachmentRow';
import { ComposerShell } from '~/components/composer/ComposerShell';
import { ComposerTextInput } from '~/components/composer/ComposerTextInput';
import { ComposerToolbar } from '~/components/composer/ComposerToolbar';
import { InlineErrorBanner } from '~/components/composer/InlineErrorBanner';
import { useComposerController } from '~/components/composer/useComposerController';
import { getVoiceComposerErrorPresentation } from '~/components/composer/voiceComposerInput.helpers';
import { VoiceRecordingPanel } from '~/components/composer/VoiceRecordingPanel';
import { normalizeChatTitle, useStartChatFromInbox } from '~/services/chat';
import { invalidateInboxQueries } from '~/services/inbox/inbox-refresh';
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
  const { mutateAsync: createNote, isPending: isSaving } = useCreateNote();
  const { startChat, isStartingChat } = useStartChatFromInbox();
  const inputRef = useRef<TextInput>(null);
  const isSubmitting = isSaving || isStartingChat;
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
  } = useComposerController({
    initialMessage,
    isSubmitting,
    onDraftChange,
    onClearDraft,
  });

  const handleSave = useCallback(async () => {
    if (!canSubmit || isSaving) return;
    await createNote({ text: message.trim(), fileIds: uploadedAttachmentIds });
    donateAddNoteIntent();
    await invalidateInboxQueries(queryClient);
    clearComposer();
    onComplete?.();
  }, [
    canSubmit,
    isSaving,
    createNote,
    message,
    uploadedAttachmentIds,
    queryClient,
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
      isRecording={voice.isRecording}
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
        voice.isRecording ? (
          <VoiceRecordingPanel
            startedAt={voice.recordingStartedAt}
            onCancel={() => void voice.cancelVoiceRecording()}
            onDone={() => void voice.handleVoicePress()}
          />
        ) : voice.voiceState === 'failed' && voice.error ? (
          <InlineErrorBanner
            message={getVoiceComposerErrorPresentation(voice.error.code).message}
            onDismiss={voice.clearError}
          />
        ) : (
          <InlineEnhancePanel enhance={enhance} text={message} onEnhanced={setMessage} />
        )
      }
      toolbar={
        <ComposerToolbar
          mode="inbox"
          isRecording={voice.isRecording}
          isRecordingElsewhere={voice.isRecordingElsewhere}
          isVoiceBusy={voice.isBusy}
          isEnhancing={enhance.isEnhancing}
          isCleaningVoice={voice.isCleaningVoice}
          canPickMedia={canPickMedia}
          canToggleVoice={canToggleVoice}
          canEnhance={canOpenEnhance}
          canSubmit={canSubmit}
          isSubmitting={isSubmitting}
          onVoicePress={() => void voice.handleVoicePress()}
          onEnhancePress={enhance.toggleEnhance}
          onSubmit={() => void (isChatEntryMode ? handleStartChat() : handleSave())}
          submitTestID={isChatEntryMode ? 'composer-submit-chat' : 'composer-submit-note'}
          submitAccessibilityLabel={
            isChatEntryMode
              ? t.inbox.screen.startChatSubmitA11y
              : t.inboxComposer.composer.saveNoteA11y
          }
          secondaryAction={secondaryAction}
        />
      }
    />
  );
}
