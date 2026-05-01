import { spacing } from '@hominem/ui/tokens';
import { useQueryClient } from '@tanstack/react-query';
import type { RelativePathString } from 'expo-router';
import { useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { Keyboard, View } from 'react-native';
import { useAnimatedKeyboard } from 'react-native-keyboard-controller';
import { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { buildChatTitle } from '~/components/composer/composerActions';
import { ActionButton, MediaButton } from '~/components/composer/ComposerButtons';
import { ComposerActionGroup } from '~/components/composer/ComposerActionGroup';
import { ComposerAttachmentRow } from '~/components/composer/ComposerAttachmentRow';
import { ComposerPill } from '~/components/composer/ComposerPill';
import { useComposerBase } from '~/components/composer/useComposerBase';
import { ComposerTextInput } from '~/components/composer/ComposerTextInput';
import { CameraModal } from '~/components/media/camera-modal';
import { makeStyles } from '~/components/theme';
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
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const keyboard = useAnimatedKeyboard();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { requestTopReveal } = useTopAnchoredFeed();
  const { mutateAsync: createNote, isPending: isSaving } = useCreateNote();
  const { mutateAsync: createChat, isPending: isChatCreating } = useCreateChat();

  const {
    message, setMessage,
    attachments,
    isCameraOpen, setIsCameraOpen,
    inputRef,
    uploadState,
    uploadedAttachmentIds,
    canSubmit,
    clearDraft,
    handleRemoveAttachment,
    showPlusMenu,
    onContentSizeChange,
    enhance, isEnhancing,
    handleCameraCapture,
    inputStyle,
  } = useComposerBase({ seedMessage });

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
  }, [canSubmit, isSaving, createNote, message, uploadedAttachmentIds, queryClient, requestTopReveal, clearDraft]);

  const handleChat = useCallback(async () => {
    if (!canSubmit || isChatCreating) return;
    const chat = await createChat({ title: buildChatTitle(message) });
    clearDraft();
    router.push(
      `/(protected)/(tabs)/chat/${chat.id}?initialMessage=${encodeURIComponent(message.trim())}` as RelativePathString,
    );
    requestTopReveal();
  }, [canSubmit, isChatCreating, createChat, message, clearDraft, router, requestTopReveal]);

  const shellStyle = useAnimatedStyle(() => ({
    bottom: keyboard.height.value + Math.max(insets.bottom, spacing[2]),
  }));

  return (
    <>
      <ComposerPill
        testID="feed-composer"
        onLayout={(e) => {
          onClearanceChange?.(e.nativeEvent.layout.height + Math.max(insets.bottom, spacing[2]));
        }}
        style={[styles.container, shellStyle]}
      >
        <ComposerAttachmentRow
          attachments={attachments}
          errors={uploadState.errors}
          isUploading={uploadState.isUploading}
          progressByAssetId={uploadState.progressByAssetId}
          onRemove={handleRemoveAttachment}
        />
        <ComposerTextInput
          inputRef={inputRef}
          value={message}
          onChangeText={setMessage}
          onContentSizeChange={onContentSizeChange}
          placeholder={t.feed.composer.placeholder}
          testID="feed-composer-input"
          inputStyle={inputStyle}
        />
        <View style={styles.actionRow}>
          <MediaButton
            accessibilityLabel={t.feed.composer.addAttachmentA11y}
            icon="plus"
            onPress={showPlusMenu}
          />
          <ComposerActionGroup hasContent={message.trim().length > 0}>
            <ActionButton
              accessibilityLabel={t.feed.composer.enhanceTextA11y}
              icon="wand.and.sparkles"
              onPress={() => void enhance(message).then(setMessage)}
              disabled={isEnhancing}
            />
            <ActionButton
              accessibilityLabel={t.feed.composer.openChatA11y}
              disabled={!canSubmit || isSaving || isChatCreating}
              icon="bubble.left"
              onPress={() => void handleChat()}
            />
            <ActionButton
              accessibilityLabel={t.feed.composer.saveNoteA11y}
              disabled={!canSubmit || isSaving || isChatCreating}
              icon="arrow.up"
              onPress={() => void handleSave()}
            />
          </ComposerActionGroup>
        </View>
      </ComposerPill>

      <CameraModal
        visible={isCameraOpen}
        onCapture={(photo) => void handleCameraCapture(photo)}
        onClose={() => setIsCameraOpen(false)}
      />
    </>
  );
}

const useStyles = makeStyles((theme) => ({
  container: {
    left: 0,
    right: 0,
    paddingHorizontal: spacing[2],
    position: 'absolute',
    alignItems: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
}));
