import { useQueryClient } from '@tanstack/react-query';
import type { RelativePathString } from 'expo-router';
import { useRouter } from 'expo-router';
import React, { useCallback, useRef } from 'react';
import { Keyboard, TextInput } from 'react-native';

import { ComposerActionGroup } from '~/components/composer/ComposerActionGroup';
import { buildChatTitle } from '~/components/composer/composerActions';
import { ComposerAttachmentRow } from '~/components/composer/ComposerAttachmentRow';
import { ActionButton, MediaButton } from '~/components/composer/ComposerButtons';
import { ComposerTextInput } from '~/components/composer/ComposerTextInput';
import { ComposerToolbar } from '~/components/composer/ComposerToolbar';
import { useComposerBase } from '~/components/composer/useComposerBase';
import { useComposerMediaMenu } from '~/components/composer/useComposerMediaMenu';
import { CameraModal } from '~/components/media/camera-modal';
import { useCreateChat } from '~/services/chat/use-create-chat';
import { invalidateInboxQueries } from '~/services/inbox/inbox-refresh';
import { useTopAnchoredFeed } from '~/services/inbox/top-anchored-feed';
import { donateAddNoteIntent } from '~/services/intent-donation';
import { useCreateNote } from '~/services/notes/use-create-note';
import t from '~/translations';

interface FeedComposerProps {
  onClearanceChange?: (height: number) => void;
  seedMessage?: string;
}

export function FeedComposer({ onClearanceChange, seedMessage }: FeedComposerProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { requestTopReveal } = useTopAnchoredFeed();
  const { mutateAsync: createNote, isPending: isSaving } = useCreateNote();
  const { mutateAsync: createChat, isPending: isChatCreating } = useCreateChat();
  const inputRef = useRef<TextInput>(null);

  const {
    message,
    setMessage,
    attachments,
    uploadState,
    uploadedAttachmentIds,
    canSubmit,
    clearDraft,
    handleRemoveAttachment,
    pickAttachment,
    enhance,
    isEnhancing,
    handleCameraCapture,
  } = useComposerBase({ seedMessage });
  const { isCameraOpen, setIsCameraOpen, showPlusMenu } = useComposerMediaMenu({ pickAttachment });

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
    const chat = await createChat({ title: buildChatTitle(message) });
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
    <>
      <ComposerToolbar
        accessory={
          hasAccessory ? (
            <ComposerAttachmentRow
              attachments={attachments}
              errors={uploadState.errors}
              isUploading={uploadState.isUploading}
              progressByAssetId={uploadState.progressByAssetId}
              onRemove={handleRemoveAttachment}
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
        onLayout={(e) => onClearanceChange?.(e.nativeEvent.layout.height)}
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
          <MediaButton
            accessibilityLabel={t.feed.composer.addAttachmentA11y}
            icon="plus"
            onPress={showPlusMenu}
          />
        }
        testID="feed-composer"
      />

      <CameraModal
        visible={isCameraOpen}
        onCapture={(photo) => {
          void handleCameraCapture(photo).finally(() => setIsCameraOpen(false));
        }}
        onClose={() => setIsCameraOpen(false)}
      />
    </>
  );
}
