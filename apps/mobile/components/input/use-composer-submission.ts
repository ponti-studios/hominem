import { useApiClient } from '@hominem/rpc/react';
import type { Note } from '@hominem/rpc/types';
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
import { chatKeys, noteKeys } from '~/services/notes/query-keys';
import { useCreateNote } from '~/services/notes/use-create-note';
import { useNoteQuery } from '~/services/notes/use-note-query';
import { donateAddNoteIntent } from '~/services/intent-donation';

import {
  buildChatTitle,
  buildNoteContent,
  canSubmitComposerDraft,
  getUploadedAttachmentIds,
  mergeNoteIntoCache,
  mergeUniqueIds,
  resolveComposerPrimaryAction,
  resolveComposerSecondaryAction,
} from './composer-actions';
import type { ComposerTarget, MobileComposerAttachment } from './composer-state';

type UseComposerSubmissionOptions = {
  target: ComposerTarget;
  attachments: MobileComposerAttachment[];
  message: string;
  selectedNoteIds: string[];
  isUploading: boolean;
  setAttachments: (
    value:
      | MobileComposerAttachment[]
      | ((currentValue: MobileComposerAttachment[]) => MobileComposerAttachment[]),
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
  const noteQuery = useNoteQuery({
    noteId: target.noteId ?? '',
    enabled: target.kind === 'note' && Boolean(target.noteId),
  });

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

  const appendToCurrentNote = async () => {
    const note = noteQuery.data;

    if (!note) {
      return;
    }

    const updatedNote = await client.notes.update({
      id: note.id,
      title: note.title ?? null,
      content: buildNoteContent(note.content, message),
      fileIds: mergeUniqueIds(
        note.files.map((file) => file.id),
        uploadedAttachmentIds,
      ),
    });

    queryClient.setQueryData(noteKeys.detail(note.id), updatedNote);
    queryClient.setQueryData<Note[]>(noteKeys.all, (currentNotes) =>
      mergeNoteIntoCache(currentNotes, updatedNote),
    );
    await invalidateInboxQueries(queryClient);
    clearDraft();
  };

  const handlePrimaryAction = () => {
    if (!canSubmit) {
      return;
    }

    const action = resolveComposerPrimaryAction(target.kind);

    if (action === 'send_chat') {
      void sendChatMessage({
        message: message.trim(),
        ...(uploadedAttachmentIds.length > 0 ? { fileIds: uploadedAttachmentIds } : {}),
        ...(selectedNoteIds.length > 0 ? { noteIds: selectedNoteIds } : {}),
      }).then(() => {
        clearDraft();
      });
      return;
    }

    if (action === 'append_note') {
      void appendToCurrentNote();
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
