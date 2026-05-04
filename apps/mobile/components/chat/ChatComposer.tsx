import { useApiClient } from '@hominem/rpc/react';
import type { NoteSearchResult } from '@hominem/rpc/types';
import { useQueryClient } from '@tanstack/react-query';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { TextInput } from 'react-native';

import {
  ComposerAccessories,
  useComposerAttachments,
} from '~/components/composer/ComposerAccessories';
import { ComposerActionGroup } from '~/components/composer/ComposerActionGroup';
import { getNoteIds, isDefaultChatTitle } from '~/components/composer/composerActions';
import { ActionButton } from '~/components/composer/ComposerButtons';
import { ComposerProvider } from '~/components/composer/ComposerContext';
import { ComposerMedia } from '~/components/composer/ComposerMedia';
import { ComposerSurface } from '~/components/composer/ComposerSurface';
import { ComposerTextInput } from '~/components/composer/ComposerTextInput';
import {
  getTrailingMentionQuery,
  removeTrailingMentionQuery,
} from '~/components/composer/note-mentions';
import { useComposer } from '~/components/composer/useComposer';
import {
  normalizeChatTitle,
  updateChatTitleCaches,
  useActiveChat,
  useSendMessage,
} from '~/services/chat';
import { chatKeys } from '~/services/notes/query-keys';
import { useNoteSearch } from '~/services/notes/use-note-search';
import t from '~/translations';

interface ChatComposerProps {
  chatId: string;
  initialMessage?: string;
}

export function ChatComposer({ chatId, initialMessage }: ChatComposerProps) {
  return (
    <ComposerProvider seedMessage={initialMessage}>
      <ChatComposerContent chatId={chatId} />
    </ComposerProvider>
  );
}

function ChatComposerContent({ chatId }: { chatId: string }) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const { data: activeChat } = useActiveChat(chatId);
  const resolvedChatId = activeChat?.id ?? chatId;

  const [selectedNotes, setSelectedNotes] = useState<NoteSearchResult[]>([]);
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

  const handleSend = useCallback(async () => {
    if (!canSubmit || isChatSending) return;
    const trimmedMessage = message.trim();
    const noteIds = getNoteIds(selectedNotes);
    await sendChatMessage({
      message: trimmedMessage,
      ...(uploadedAttachmentIds.length > 0 ? { fileIds: uploadedAttachmentIds } : {}),
      ...(noteIds.length > 0 ? { noteIds } : {}),
      ...(selectedNotes.length > 0 ? { referencedNotes: selectedNotes } : {}),
    });

    if (trimmedMessage.length > 0) {
      const currentChat = queryClient.getQueryData<{ title: string } | null>(
        chatKeys.activeChat(resolvedChatId),
      );
      if (currentChat && isDefaultChatTitle(currentChat.title)) {
        const nextTitle = normalizeChatTitle(trimmedMessage);
        if (!isDefaultChatTitle(nextTitle)) {
          const updatedAt = new Date().toISOString();
          updateChatTitleCaches(queryClient, {
            chatId: resolvedChatId,
            title: nextTitle,
            updatedAt,
          });
          try {
            await client.api.chats[':id'].$patch({
              param: { id: resolvedChatId },
              json: { title: nextTitle },
            });
          } catch {
            await queryClient.invalidateQueries({
              queryKey: chatKeys.activeChat(resolvedChatId),
            });
          }
        }
      }
    }
    clearDraft();
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
    <ComposerSurface
      testID="chat-input"
      accessory={
        hasAccessory ? (
          <ComposerAccessories
            selectedNotes={selectedNotes}
            onRemoveNote={handleRemoveNote}
            mentionSuggestions={mentionSuggestions}
            onSelectMention={handleSelectMention}
          />
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
        <ComposerMedia
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
            onPress={() => void handleSend()}
            disabled={!canSubmit || isChatSending}
            accessibilityLabel={
              isChatSending ? t.chat.input.sendingA11y : t.chat.input.sendMessageA11y
            }
          />
        </ComposerActionGroup>
      }
    />
  );
}
