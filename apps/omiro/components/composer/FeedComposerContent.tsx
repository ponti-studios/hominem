import { useQueryClient } from '@tanstack/react-query';
import type { RelativePathString } from 'expo-router';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef } from 'react';
import { Alert, TextInput } from 'react-native';

import { InlineEnhanceTray } from '~/components/ai/InlineEnhanceTray';
import { ComposerAttachmentRow } from '~/components/composer/ComposerAttachmentRow';
import { ComposerShell } from '~/components/composer/ComposerShell';
import { ComposerTextInput } from '~/components/composer/ComposerTextInput';
import { ComposerToolbar } from '~/components/composer/ComposerToolbar';
import { useComposerController } from '~/components/composer/useComposerController';
import { normalizeChatTitle } from '~/services/chat';
import { useCreateChat } from '~/services/chat/use-create-chat';
import { invalidateInboxQueries } from '~/services/inbox/inbox-refresh';
import { useTopAnchoredFeed } from '~/services/inbox/top-anchored-feed';
import { donateAddNoteIntent } from '~/services/intent-donation';
import { useCreateNote } from '~/services/notes/use-create-note';
import { writeChatComposerHandoff } from '~/services/workspace/launch-state';
import { getWorkspaceArtifactRoute } from '~/services/workspace/routes';
import t from '~/translations';

export interface FeedComposerContentProps {
  initialMessage?: string;
  onDraftChange?: (msg: string) => void;
  onClearDraft?: () => void;
  entryMode?: 'mixed' | 'note' | 'chat';
  onComplete?: () => void;
  testID?: string;
}

export function FeedComposerContent({
  initialMessage,
  onDraftChange,
  onClearDraft,
  entryMode = 'mixed',
  onComplete,
  testID,
}: FeedComposerContentProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { requestTopReveal } = useTopAnchoredFeed();
  const { mutateAsync: createNote, isPending: isSaving } = useCreateNote();
  const { mutateAsync: createChat, isPending: isChatCreating } = useCreateChat();
  const inputRef = useRef<TextInput>(null);
  const isSubmitting = isSaving || isChatCreating;
  const {
    message,
    setMessage,
    attachments,
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
    hydrationKey: 'feed',
    initialMessage,
    isSubmitting,
    onDraftChange,
    onClearDraft,
  });

  useEffect(() => {
    if (!voiceError) return;
    Alert.alert(voiceError.title, voiceError.message, [{ text: 'OK', onPress: clearVoiceError }]);
  }, [clearVoiceError, voiceError]);

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
    if (!canSubmit || isChatCreating) return;
    const title = normalizeChatTitle(message);
    const chat = await createChat({ title });
    writeChatComposerHandoff(chat.id, {
      attachments,
      message: message.trim(),
    });
    clearComposer();
    router.push(
      getWorkspaceArtifactRoute('chat', chat.id, {
        initialMessage: message.trim(),
      }) as RelativePathString,
    );
    requestTopReveal();
    onComplete?.();
  }, [
    canSubmit,
    isChatCreating,
    createChat,
    attachments,
    message,
    clearComposer,
    router,
    requestTopReveal,
    onComplete,
  ]);

  const isChatEntryMode = entryMode === 'chat';
  const inputPlaceholder = isChatEntryMode
    ? t.chat.input.messagePlaceholder
    : t.feed.composer.placeholder;
  const shellTestId = testID ?? 'feed-composer';
  const inputTestId = 'feed-composer-input';
  const secondaryAction = isChatEntryMode
    ? {
        accessibilityLabel: t.feed.composer.saveNoteA11y,
        icon: 'doc.text' as const,
        onPress: () => void handleSave(),
        testID: 'composer-save-note',
      }
    : {
        accessibilityLabel: t.feed.composer.openChatA11y,
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
          mode="feed"
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
            isChatEntryMode ? t.workspace.home.startChatSubmitA11y : t.feed.composer.saveNoteA11y
          }
          secondaryAction={secondaryAction}
        />
      }
    />
  );
}
