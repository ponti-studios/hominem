import { useApiClient } from '@hominem/rpc/react';
import type { Chat } from '@hominem/rpc/types';
import { useQueryClient } from '@tanstack/react-query';
import type { RelativePathString } from 'expo-router';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';

import { useSendMessage } from '~/services/chat';
import type { ChatWithActivity } from '~/services/chat/session-state';
import {
  createChatInboxRefreshSnapshot,
  invalidateInboxQueries,
  upsertInboxSessionActivity,
} from '~/services/inbox/inbox-refresh';
import { chatKeys } from '~/services/notes/query-keys';
import { useCreateNote } from '~/services/notes/use-create-note';
import { donateAddNoteIntent } from '~/services/intent-donation';

import {
  buildChatTitle,
  canSubmitComposerDraft,
  getUploadedAttachmentIds,
  isDefaultChatTitle,
  resolveComposerPrimaryAction,
  resolveComposerSecondaryAction,
} from './composerActions';
import { updateChatTitleCaches } from '~/services/chat/chat-title';
import type { ComposerTarget, ComposerAttachment } from './composerState';

type UseComposerSubmissionOptions = {
  target: ComposerTarget;
  attachments: ComposerAttachment[];
  message: string;
  selectedNoteIds: string[];
  isUploading: boolean;
  setAttachments: (
    value:
      | ComposerAttachment[]
      | ((currentValue: ComposerAttachment[]) => ComposerAttachment[]),
  ) => void;
  clearDraft: () => void;
};

export function useComposerSubmission({
  target,
  attachments,
  message,
  selectedNoteIds,
  isUploading,
  setAttachments,
  clearDraft,
}: UseComposerSubmissionOptions) {
  const client = useApiClient();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { mutateAsync: createNote } = useCreateNote();
  const { sendChatMessage, isChatSending } = useSendMessage({ chatId: target.chatId ?? '' });

  const uploadedAttachmentIds = useMemo(() => getUploadedAttachmentIds(attachments), [attachments]);
  const canSubmit = canSubmitComposerDraft({
    isUploading,
    message,
    uploadedAttachmentIds,
  });

  const createChatFromDraft = async () => {
    const trimmedMessage = message.trim();
    const chat = await client.chats.create({
      title: buildChatTitle(message),
    });

    if (trimmedMessage || uploadedAttachmentIds.length > 0) {
      await client.chats.send({
        chatId: chat.id,
        message: trimmedMessage,
        ...(uploadedAttachmentIds.length > 0 ? { fileIds: uploadedAttachmentIds } : {}),
      });
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
  };

  const createNoteFromDraft = async () => {
    await createNote({
      text: message.trim(),
      ...(uploadedAttachmentIds.length > 0 ? { fileIds: uploadedAttachmentIds } : {}),
    });
    donateAddNoteIntent();
    await invalidateInboxQueries(queryClient);
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
      void sendChatMessage({
        message: trimmedMessage,
        ...(uploadedAttachmentIds.length > 0 ? { fileIds: uploadedAttachmentIds } : {}),
        ...(selectedNoteIds.length > 0 ? { noteIds: selectedNoteIds } : {}),
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
