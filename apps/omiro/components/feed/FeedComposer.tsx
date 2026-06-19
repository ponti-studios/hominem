import type { TextInputRef as ExpoTextInputRef } from '@expo/ui';
import { useQueryClient } from '@tanstack/react-query';
import type { RelativePathString } from 'expo-router';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Keyboard } from 'react-native';

import { InlineEnhanceTray } from '~/components/ai/InlineEnhanceTray';
import { ComposerActionGroup } from '~/components/composer/ComposerActionGroup';
import { ComposerAttachmentRow } from '~/components/composer/ComposerAttachmentRow';
import { ActionButton } from '~/components/composer/ComposerButtons';
import {
  ComposerProvider,
  useComposerAttachments,
  useComposerContext,
} from '~/components/composer/ComposerContext';
import { ComposerMedia } from '~/components/composer/ComposerMedia';
import { useComposer } from '~/components/composer/useComposer';
import { useVoiceComposerInput } from '~/components/composer/useVoiceComposerInput';
import { WorkspaceComposerShell } from '~/components/feed/WorkspaceComposerShell';
import { useInlineEnhance } from '~/services/ai';
import { normalizeChatTitle } from '~/services/chat';
import { useCreateChat } from '~/services/chat/use-create-chat';
import { invalidateInboxQueries } from '~/services/inbox/inbox-refresh';
import { useTopAnchoredFeed } from '~/services/inbox/top-anchored-feed';
import { donateAddNoteIntent } from '~/services/intent-donation';
import { useCreateNote } from '~/services/notes/use-create-note';
import { clearFeedDraft, readFeedDraft, writeFeedDraft } from '~/services/workspace/launch-state';
import { getWorkspaceArtifactRoute } from '~/services/workspace/routes';
import t from '~/translations';

interface FeedComposerProps {
  seedMessage?: string;
}

export function FeedComposer({ seedMessage }: FeedComposerProps) {
  return (
    <ComposerProvider seedMessage={seedMessage}>
      <FeedComposerInner />
    </ComposerProvider>
  );
}

function FeedComposerInner() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { requestTopReveal } = useTopAnchoredFeed();
  const { mutateAsync: createNote, isPending: isSaving } = useCreateNote();
  const { mutateAsync: createChat, isPending: isChatCreating } = useCreateChat();
  const inputRef = useRef<ExpoTextInputRef>(null);
  const { seedMessage } = useComposerContext();
  const [isFocused, setIsFocused] = useState(false);

  const {
    message,
    messageState,
    setMessage,
    uploadState,
    uploadedAttachmentIds,
    canSubmit,
    clearDraft,
  } = useComposer({
    initialDraft: readFeedDraft(),
    onDraftChange: writeFeedDraft,
    onExtraClearDraft: clearFeedDraft,
  });
  const {
    handleVoicePress,
    isBusy: isVoiceBusy,
    isCleaningVoice,
    isRecording,
    error: voiceError,
    clearError: clearVoiceError,
  } = useVoiceComposerInput({ message, setMessage });
  const { attachments } = useComposerAttachments();
  const {
    isEnhanceOpen,
    enhanceInstruction,
    setEnhanceInstruction,
    enhanceError,
    isEnhancing,
    toggleEnhance,
    closeEnhance,
    runEnhance,
  } = useInlineEnhance();

  const handleSave = useCallback(async () => {
    if (!canSubmit || isSaving) return;
    await createNote({
      text: message.trim(),
      fileIds: uploadedAttachmentIds,
    });
    donateAddNoteIntent();
    await invalidateInboxQueries(queryClient);
    requestTopReveal();
    clearDraft();
    Keyboard.dismiss();
  }, [
    canSubmit,
    isSaving,
    createNote,
    message,
    uploadedAttachmentIds,
    queryClient,
    requestTopReveal,
    clearDraft,
  ]);

  const handleChat = useCallback(async () => {
    if (!canSubmit || isChatCreating) return;
    const title = normalizeChatTitle(message);
    const chat = await createChat({ title });
    clearDraft();
    router.push(
      getWorkspaceArtifactRoute('chat', chat.id, {
        initialMessage: message.trim(),
      }) as RelativePathString,
    );
    requestTopReveal();
  }, [canSubmit, isChatCreating, createChat, message, clearDraft, router, requestTopReveal]);

  const hasContent = message.trim().length > 0;
  const hasAccessory =
    attachments.length > 0 || uploadState.errors.length > 0 || uploadState.isUploading;
  const isExpanded = isFocused || hasContent || hasAccessory || isEnhanceOpen;

  useEffect(() => {
    if (!voiceError) return;

    Alert.alert(voiceError.title, voiceError.message, [
      {
        text: 'OK',
        onPress: clearVoiceError,
      },
    ]);
  }, [clearVoiceError, voiceError]);

  return (
    <WorkspaceComposerShell
      autoFocus={Boolean(seedMessage)}
      accessory={hasAccessory ? <ComposerAttachmentRow /> : undefined}
      inlinePanel={
        isEnhanceOpen ? (
          <InlineEnhanceTray
            instruction={enhanceInstruction}
            onInstructionChange={setEnhanceInstruction}
            onCancel={closeEnhance}
            onConfirm={() => void runEnhance({ text: message, onEnhanced: setMessage })}
            isEnhancing={isEnhancing}
            error={enhanceError}
          />
        ) : undefined
      }
      actions={
        <ComposerActionGroup hasContent={hasContent}>
          <ActionButton
            accessibilityLabel={
              isRecording ? t.feed.composer.stopVoiceInputA11y : t.feed.composer.startVoiceInputA11y
            }
            icon={isRecording ? 'stop.fill' : 'mic.fill'}
            onPress={() => void handleVoicePress()}
            disabled={isSaving || isChatCreating || isEnhancing || isCleaningVoice}
            isAnimating={isVoiceBusy}
          />
          <ActionButton
            accessibilityLabel={t.feed.composer.enhanceTextA11y}
            icon="wand.and.sparkles"
            onPress={toggleEnhance}
            disabled={!hasContent || isSaving || isChatCreating || isEnhancing || isVoiceBusy}
            isAnimating={isEnhancing || isCleaningVoice}
          />
          <ActionButton
            accessibilityLabel={t.feed.composer.openChatA11y}
            disabled={!canSubmit || isSaving || isChatCreating || isEnhancing || isVoiceBusy}
            icon="bubble.left"
            onPress={() => void handleChat()}
          />
          <ActionButton
            accessibilityLabel={t.feed.composer.saveNoteA11y}
            disabled={!canSubmit || isSaving || isChatCreating || isEnhancing || isVoiceBusy}
            icon="arrow.up"
            onPress={() => void handleSave()}
          />
        </ComposerActionGroup>
      }
      inputRef={inputRef}
      isExpanded={isExpanded}
      leadingAction={
        <ComposerMedia
          accessibilityLabel={t.feed.composer.addAttachmentA11y}
          disabled={isSaving || isChatCreating}
        />
      }
      messageState={messageState}
      onBlur={() => setIsFocused(false)}
      onChangeText={setMessage}
      onFocus={() => setIsFocused(true)}
      placeholder={t.feed.composer.placeholder}
      testID="feed-composer"
    />
  );
}
