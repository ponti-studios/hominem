import { useApiClient } from '@hominem/rpc/react';
import type { Chat } from '@hominem/rpc/types';
import { useQueryClient } from '@tanstack/react-query';
import type { RelativePathString } from 'expo-router';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Platform } from 'react-native';

import { useSendMessage } from '~/services/chat';
import { updateChatTitleCaches } from '~/services/chat/chat-title';
import type { ChatWithActivity } from '~/services/chat/session-state';
import {
  createChatInboxRefreshSnapshot,
  invalidateInboxQueries,
  upsertInboxSessionActivity,
} from '~/services/inbox/inbox-refresh';
import { useTopAnchoredFeed } from '~/services/inbox/top-anchored-feed';
import { donateAddNoteIntent } from '~/services/intent-donation';
import { chatKeys } from '~/services/notes/query-keys';
import { useCreateNote } from '~/services/notes/use-create-note';

import {
  buildChatTitle,
  canSubmitComposerDraft,
  getSelectedNoteIds,
  getUploadedAttachmentIds,
  isDefaultChatTitle,
  resolveComposerPrimaryAction,
  resolveComposerSecondaryAction,
} from './composerActions';
import type { ComposerAttachment, ComposerSelectedNote, ComposerTarget } from './composerState';

type UseComposerSubmissionOptions = {
  target: ComposerTarget;
  attachments: ComposerAttachment[];
  message: string;
  selectedNotes: ComposerSelectedNote[];
  isUploading: boolean;
  setAttachments: (
    value: ComposerAttachment[] | ((currentValue: ComposerAttachment[]) => ComposerAttachment[]),
  ) => void;
  clearDraft: () => void;
};

export function useComposerSubmission({
  target,
  attachments,
  message,
  selectedNotes,
  isUploading,
  setAttachments,
  clearDraft,
}: UseComposerSubmissionOptions) {
  const client = useApiClient();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { requestTopReveal } = useTopAnchoredFeed();
  const { mutateAsync: createNote } = useCreateNote();
  const { sendChatMessage, isChatSending } = useSendMessage({ chatId: target.chatId ?? '' });

  const uploadedAttachmentIds = useMemo(() => getUploadedAttachmentIds(attachments), [attachments]);
  const canSubmit = canSubmitComposerDraft({
    isUploading,
    message,
    uploadedAttachmentIds,
    selectedNotes,
  });

  const createChatFromDraft = async () => {
    const trimmedMessage = message.trim();
    const chat = await client.chats.create({
      title: buildChatTitle(message),
    });

    if (trimmedMessage || uploadedAttachmentIds.length > 0) {
      const body = await client.chats.stream({
        chatId: chat.id,
        message: trimmedMessage,
        ...(uploadedAttachmentIds.length > 0 ? { fileIds: uploadedAttachmentIds } : {}),
      });

      const reader = body.getReader();
      try {
        while (true) {
          const { done } = await reader.read();
          if (done) break;
        }
      } finally {
        reader.releaseLock();
      }
    }

    queryClient.setQueryData<ChatWithActivity[] | undefined>(
      chatKeys.resumableSessions,
      (previousSessions) =>
        upsertInboxSessionActivity(
          previousSessions ?? [],
          createChatInboxRefreshSnapshot({
            chatId: chat.id,
            noteId: chat.noteId,
            title: chat.title,
            timestamp: chat.createdAt,
            userId: chat.userId,
          }),
        ),
    );
    await invalidateInboxQueries(queryClient);
    clearDraft();
    router.push(`/(protected)/(tabs)/chat/${chat.id}` as RelativePathString);
    if (target.kind === 'feed') {
      requestTopReveal();
    }
  };

  const createNoteFromDraft = async () => {
    await createNote({
      text: message.trim(),
      ...(uploadedAttachmentIds.length > 0 ? { fileIds: uploadedAttachmentIds } : {}),
    });
    if (Platform.OS === 'ios') {
      donateAddNoteIntent();
    }
    await invalidateInboxQueries(queryClient);
    if (target.kind === 'feed') {
      requestTopReveal();
    }
    clearDraft();
  };

  const maybeUpdateChatTitle = async (chatId: string, nextTitleSource: string) => {
    const currentChat = queryClient.getQueryData<Chat | null>(chatKeys.activeChat(chatId));
    if (!currentChat || !isDefaultChatTitle(currentChat.title)) {
      return;
    }

    const nextTitle = buildChatTitle(nextTitleSource);
    if (isDefaultChatTitle(nextTitle)) {
      return;
    }

    const updatedAt = new Date().toISOString();
    updateChatTitleCaches(queryClient, {
      chatId,
      title: nextTitle,
      updatedAt,
    });

    try {
      await client.chats.update({
        chatId,
        title: nextTitle,
      });
    } catch {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: chatKeys.activeChat(chatId) }),
        invalidateInboxQueries(queryClient),
      ]);
    }
  };

  const handlePrimaryAction = () => {
    if (!canSubmit) {
      return;
    }

    const action = resolveComposerPrimaryAction(target.kind);

    if (action === 'send_chat') {
      const trimmedMessage = message.trim();
      const noteIds = getSelectedNoteIds(selectedNotes);
      void sendChatMessage({
        message: trimmedMessage,
        ...(uploadedAttachmentIds.length > 0 ? { fileIds: uploadedAttachmentIds } : {}),
        ...(noteIds.length > 0 ? { noteIds } : {}),
        ...(selectedNotes.length > 0 ? { referencedNotes: selectedNotes } : {}),
      }).then(async () => {
        if (target.chatId && trimmedMessage.length > 0) {
          await maybeUpdateChatTitle(target.chatId, trimmedMessage);
        }
        clearDraft();
      });
      return;
    }

    if (action === 'create_note') {
      void createNoteFromDraft();
    }
  };

  const handleSecondaryAction = () => {
    if (resolveComposerSecondaryAction(target.kind) === 'create_chat') {
      void createChatFromDraft();
    }
  };

  const handleRemoveAttachment = (attachmentId: string) => {
    const attachmentToRemove = attachments.find((attachment) => attachment.id === attachmentId);

    setAttachments((currentAttachments) =>
      currentAttachments.filter((attachment) => attachment.id !== attachmentId),
    );

    if (!attachmentToRemove?.uploadedFile?.id) {
      return;
    }

    void client.files
      .delete({
        fileId: attachmentToRemove.uploadedFile.id,
      })
      .catch(() => undefined);
  };

  return {
    canSubmit,
    handlePrimaryAction,
    handleRemoveAttachment,
    handleSecondaryAction,
    isChatSending,
    uploadedAttachmentIds,
  };
}
