import { useApiClient } from '@hominem/rpc/react';
import type { NoteSearchResult } from '@hominem/rpc/types';
import { spacing } from '@hominem/ui/tokens';
import { useQueryClient } from '@tanstack/react-query';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  TextInput,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';

import {
  buildChatTitle,
  getSelectedNoteIds,
  isDefaultChatTitle,
} from '~/components/composer/composerActions';
import { ActionButton, MediaButton } from '~/components/composer/ComposerButtons';
import { ComposerActionGroup } from '~/components/composer/ComposerActionGroup';
import { ComposerAttachmentRow } from '~/components/composer/ComposerAttachmentRow';
import { ComposerToolbar } from '~/components/composer/ComposerToolbar';
import type { ComposerSelectedNote } from '~/components/composer/composerState';
import { useComposerMediaMenu } from '~/components/composer/useComposerMediaMenu';
import {
  getTrailingMentionQuery,
  removeTrailingMentionQuery,
} from '~/components/composer/note-mentions';
import { useComposerBase } from '~/components/composer/useComposerBase';
import { ComposerTextInput } from '~/components/composer/ComposerTextInput';
import { CameraModal } from '~/components/media/camera-modal';
import { makeStyles, useThemeColors } from '~/components/theme';
import AppIcon from '~/components/ui/icon';

import { chatKeys } from '~/services/notes/query-keys';
import { updateChatTitleCaches, useActiveChat, useSendMessage } from '~/services/chat';
import { useNoteSearch } from '~/services/notes/use-note-search';
import t from '~/translations';

function SelectionSummary({
  selectedNotes,
  onRemove,
}: {
  selectedNotes: ComposerSelectedNote[];
  onRemove: (noteId: string) => void;
}) {
  const themeColors = useThemeColors();
  const styles = useStyles();

  if (selectedNotes.length === 0) return null;

  return (
    <View style={styles.selectionRow}>
      {selectedNotes.map((note) => (
        <View key={note.id} style={styles.selectionChip}>
          <AppIcon name="bubble.left" size={spacing[3]} tintColor={themeColors['text-secondary']} />
          <Animated.Text style={styles.selectionChipText}>
            {note.title || t.workspace.item.untitledNote}
          </Animated.Text>
          <Pressable
            accessibilityLabel={t.chat.input.removeNoteA11y(
              note.title ?? t.workspace.item.untitled,
            )}
            accessibilityRole="button"
            hitSlop={spacing[2]}
            onPress={() => onRemove(note.id)}
            style={({ pressed }) => [
              styles.selectionChipButton,
              pressed ? styles.selectionChipButtonPressed : null,
            ]}
          >
            <AppIcon name="xmark" size={spacing[2] + 2} tintColor={themeColors['text-secondary']} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}

function MentionSuggestions({
  suggestions,
  onSelect,
}: {
  suggestions: NoteSearchResult[];
  onSelect: (note: NoteSearchResult) => void;
}) {
  const styles = useStyles();

  if (suggestions.length === 0) return null;

  return (
    <View style={styles.suggestions}>
      {suggestions.map((note) => (
        <Pressable
          key={note.id}
          accessibilityLabel={t.chat.input.linkNoteA11y(note.title ?? t.workspace.item.untitled)}
          accessibilityRole="button"
          onPress={() => onSelect(note)}
          style={({ pressed }) => [
            styles.suggestionItem,
            pressed ? styles.suggestionItemPressed : null,
          ]}
        >
          <Animated.Text style={styles.suggestionTitle}>
            {note.title || t.workspace.item.untitledNote}
          </Animated.Text>
          {note.excerpt ? (
            <Animated.Text numberOfLines={1} style={styles.suggestionExcerpt}>
              {note.excerpt}
            </Animated.Text>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

interface ChatComposerProps {
  chatId: string;
  initialMessage?: string;
}

export function ChatComposer({ chatId, initialMessage }: ChatComposerProps) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const { data: activeChat } = useActiveChat(chatId);
  const resolvedChatId = activeChat?.id ?? chatId;

  const [selectedNotes, setSelectedNotes] = useState<ComposerSelectedNote[]>([]);
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
  } = useComposerBase({
    seedMessage: initialMessage,
    selectedNotes,
    onExtraClearDraft: () => setSelectedNotes([]),
  });
  const { isCameraOpen, setIsCameraOpen, showPlusMenu } = useComposerMediaMenu({ pickAttachment });

  const { sendChatMessage, isChatSending } = useSendMessage({ chatId: resolvedChatId });
  const mentionQuery = useMemo(() => getTrailingMentionQuery(message), [message]);
  const { data: searchResults } = useNoteSearch(mentionQuery ?? '', mentionQuery !== null);
  const mentionSuggestions = useMemo(
    () =>
      (searchResults?.notes ?? []).filter((note) => !selectedNotes.some((s) => s.id === note.id)),
    [searchResults?.notes, selectedNotes],
  );

  const handleSelectMention = useCallback(
    (note: NoteSearchResult) => {
      setMessage(removeTrailingMentionQuery(message));
      setSelectedNotes((prev) => (prev.some((n) => n.id === note.id) ? prev : [...prev, note]));
      inputRef.current?.focus();
    },
    [message, setMessage, inputRef],
  );

  const handleRemoveNote = useCallback(
    (noteId: string) => setSelectedNotes((prev) => prev.filter((n) => n.id !== noteId)),
    [],
  );

  const handleSend = useCallback(() => {
    if (!canSubmit || isChatSending) return;
    const trimmedMessage = message.trim();
    const noteIds = getSelectedNoteIds(selectedNotes);
    void sendChatMessage({
      message: trimmedMessage,
      ...(uploadedAttachmentIds.length > 0 ? { fileIds: uploadedAttachmentIds } : {}),
      ...(noteIds.length > 0 ? { noteIds } : {}),
      ...(selectedNotes.length > 0 ? { referencedNotes: selectedNotes } : {}),
    }).then(async () => {
      if (trimmedMessage.length > 0) {
        const currentChat = queryClient.getQueryData<{ title: string } | null>(
          chatKeys.activeChat(resolvedChatId),
        );
        if (currentChat && isDefaultChatTitle(currentChat.title)) {
          const nextTitle = buildChatTitle(trimmedMessage);
          if (!isDefaultChatTitle(nextTitle)) {
            const updatedAt = new Date().toISOString();
            updateChatTitleCaches(queryClient, { chatId: resolvedChatId, title: nextTitle, updatedAt });
            try {
              await client.api.chats[':id'].$patch({
                param: { id: resolvedChatId },
                json: { title: nextTitle },
              });
            } catch {
              await queryClient.invalidateQueries({ queryKey: chatKeys.activeChat(resolvedChatId) });
            }
          }
        }
      }
      clearDraft();
    });
  }, [
    canSubmit,
    isChatSending,
    message,
    selectedNotes,
    uploadedAttachmentIds,
    sendChatMessage,
    queryClient,
    resolvedChatId,
    client,
    clearDraft,
  ]);
  const hasAccessory =
    attachments.length > 0 ||
    uploadState.errors.length > 0 ||
    uploadState.isUploading ||
    selectedNotes.length > 0 ||
    mentionSuggestions.length > 0;
  const hasContent = message.trim().length > 0;

  return (
    <>
      <ComposerToolbar
        testID="chat-input"
        accessory={
          hasAccessory ? (
            <>
              <ComposerAttachmentRow
                attachments={attachments}
                errors={uploadState.errors}
                isUploading={uploadState.isUploading}
                progressByAssetId={uploadState.progressByAssetId}
                onRemove={handleRemoveAttachment}
              />
              <SelectionSummary selectedNotes={selectedNotes} onRemove={handleRemoveNote} />
              <MentionSuggestions suggestions={mentionSuggestions} onSelect={handleSelectMention} />
            </>
          ) : undefined
        }
        input={
          <ComposerTextInput
            inputRef={inputRef}
            value={message}
            onChangeText={setMessage}
            placeholder={t.chat.input.messagePlaceholder}
            testID="chat-input-field"
          />
        }
        leadingAction={
          <MediaButton
            icon="plus"
            onPress={showPlusMenu}
            accessibilityLabel={t.chat.input.addAttachmentA11y}
            disabled={isChatSending}
          />
        }
        actions={
          <ComposerActionGroup hasContent={hasContent}>
            <ActionButton
              icon="wand.and.sparkles"
              onPress={() => void enhance(message).then(setMessage)}
              accessibilityLabel={t.chat.input.enhanceTextA11y}
              disabled={!hasContent || isChatSending || isEnhancing}
              isAnimating={isEnhancing}
            />
            <ActionButton
              icon="arrow.up"
              onPress={handleSend}
              disabled={!canSubmit || isChatSending}
              accessibilityLabel={isChatSending ? t.chat.input.sendingA11y : t.chat.input.sendMessageA11y}
            />
          </ComposerActionGroup>
        }
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

const useStyles = makeStyles((theme) => ({
  selectionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  selectionChip: {
    alignItems: 'center',
    backgroundColor: theme.colors['bg-surface'],
    borderColor: theme.colors['border-default'],
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing[1],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
  },
  selectionChipButton: {
    alignItems: 'center',
    borderRadius: 8,
    height: spacing[4],
    justifyContent: 'center',
    width: spacing[4],
  },
  selectionChipButtonPressed: {
    backgroundColor: theme.colors.background,
  },
  selectionChipText: {
    color: theme.colors['text-secondary'],
    fontSize: 12,
    lineHeight: 16,
  },
  suggestions: {
    backgroundColor: theme.colors['bg-surface'],
    borderColor: theme.colors['border-default'],
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  suggestionItem: {
    gap: spacing[1],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  suggestionItemPressed: {
    backgroundColor: theme.colors.background,
  },
  suggestionTitle: {
    color: theme.colors.foreground,
    fontSize: 12,
    lineHeight: 16,
  },
  suggestionExcerpt: {
    color: theme.colors['text-secondary'],
    fontSize: 12,
    lineHeight: 16,
  },
}));
