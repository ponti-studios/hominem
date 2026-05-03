import { useQueryClient } from '@tanstack/react-query';
import type { RelativePathString } from 'expo-router';
import { useRouter } from 'expo-router';
import React, { useCallback, useRef } from 'react';
import { Keyboard, TextInput } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';

import { ComposerAccessories } from '~/components/composer/ComposerAccessories';
import { ComposerActionGroup } from '~/components/composer/ComposerActionGroup';
import { ActionButton } from '~/components/composer/ComposerButtons';
import { ComposerProvider, useComposerAttachments } from '~/components/composer/ComposerContext';
import { ComposerMedia } from '~/components/composer/ComposerMedia';
import { ComposerSurface } from '~/components/composer/ComposerSurface';
import { ComposerTextInput } from '~/components/composer/ComposerTextInput';
import { useComposer } from '~/components/composer/useComposer';
import { normalizeChatTitle } from '~/services/chat';
import { useCreateChat } from '~/services/chat/use-create-chat';
import { invalidateInboxQueries } from '~/services/inbox/inbox-refresh';
import { useTopAnchoredFeed } from '~/services/inbox/top-anchored-feed';
import { donateAddNoteIntent } from '~/services/intent-donation';
import { useCreateNote } from '~/services/notes/use-create-note';
import t from '~/translations';

interface FeedComposerProps {
  onLayout?: (e: LayoutChangeEvent) => void;
  seedMessage?: string;
}

export function FeedComposer({ onLayout, seedMessage }: FeedComposerProps) {
  return (
    <ComposerProvider seedMessage={seedMessage}>
      <FeedComposerInner onLayout={onLayout} />
    </ComposerProvider>
  );
}

function FeedComposerInner({ onLayout }: { onLayout?: (e: LayoutChangeEvent) => void }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { requestTopReveal } = useTopAnchoredFeed();
  const { mutateAsync: createNote, isPending: isSaving } = useCreateNote();
  const { mutateAsync: createChat, isPending: isChatCreating } = useCreateChat();
  const inputRef = useRef<TextInput>(null);

  const {
    message,
    setMessage,
    uploadState,
    uploadedAttachmentIds,
    canSubmit,
    clearDraft,
    enhance,
    isEnhancing,
  } = useComposer();
  const { attachments } = useComposerAttachments();

  const handleSave = useCallback(async () => {
    if (!canSubmit || isSaving) return;
    await createNote({
      text: message.trim(),
      ...(uploadedAttachmentIds.length > 0 ? { fileIds: uploadedAttachmentIds } : {}),
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
    const chat = await createChat({ title: normalizeChatTitle(message) });
    clearDraft();
    router.push(
      `/(protected)/(tabs)/chat/${chat.id}?initialMessage=${encodeURIComponent(message.trim())}` as RelativePathString,
    );
    requestTopReveal();
  }, [canSubmit, isChatCreating, createChat, message, clearDraft, router, requestTopReveal]);

  const hasContent = message.trim().length > 0;

  const hasAccessory =
    attachments.length > 0 || uploadState.errors.length > 0 || uploadState.isUploading;

  return (
    <ComposerSurface
      onLayout={onLayout}
      accessory={
        hasAccessory ? (
          <ComposerAccessories
            selectedNotes={[]}
            onRemoveNote={() => {}}
            mentionSuggestions={[]}
            onSelectMention={() => {}}
          />
        ) : undefined
      }
      actions={
        <ComposerActionGroup hasContent={hasContent}>
          <ActionButton
            accessibilityLabel={t.feed.composer.enhanceTextA11y}
            icon="wand.and.sparkles"
            onPress={() => void enhance(message).then(setMessage)}
            disabled={!hasContent || isEnhancing}
            isAnimating={isEnhancing}
          />
          <ActionButton
            accessibilityLabel={t.feed.composer.openChatA11y}
            disabled={!canSubmit || isSaving || isChatCreating || isEnhancing}
            icon="bubble.left"
            onPress={() => void handleChat()}
          />
          <ActionButton
            accessibilityLabel={t.feed.composer.saveNoteA11y}
            disabled={!canSubmit || isSaving || isChatCreating || isEnhancing}
            icon="arrow.up"
            onPress={() => void handleSave()}
          />
        </ComposerActionGroup>
      }
      input={
        <ComposerTextInput
          inputRef={inputRef}
          value={message}
          onChangeText={setMessage}
          placeholder={t.feed.composer.placeholder}
          testID="feed-composer-input"
        />
      }
      leadingAction={
        <ComposerMedia
          accessibilityLabel={t.feed.composer.addAttachmentA11y}
          disabled={isSaving || isChatCreating}
        />
      }
      testID="feed-composer"
    />
  );
}
