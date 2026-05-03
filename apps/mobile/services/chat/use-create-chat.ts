import { useApiClient } from '@hominem/rpc/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  invalidateInboxQueries,
  upsertInboxSessionActivity,
  type ChatInboxRefreshSnapshot,
} from '~/services/inbox/inbox-refresh';
import { chatKeys } from '~/services/notes/query-keys';

import type { ChatWithActivity } from './session-types';

interface CreateChatInput {
  title: string;
}

export function useCreateChat() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ title }: CreateChatInput) => {
      const res = await client.api.chats.$post({ json: { title } });
      return res.json();
    },
    onSuccess: (chat) => {
      queryClient.setQueryData(chatKeys.activeChat(chat.id), chat);
      queryClient.setQueryData<ChatWithActivity[] | undefined>(chatKeys.resumableSessions, (prev) =>
        upsertInboxSessionActivity(prev ?? [], {
          chatId: chat.id,
          noteId: chat.noteId,
          title: chat.title,
          timestamp: chat.createdAt,
          userId: chat.userId,
        } satisfies ChatInboxRefreshSnapshot),
      );
      void invalidateInboxQueries(queryClient);
    },
  });
}
