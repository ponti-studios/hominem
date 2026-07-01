import { useApiClient } from '@hominem/rpc/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { invalidateInboxQueries } from '~/services/inbox/inbox-refresh';
import { chatKeys } from '~/services/notes/query-keys';
import { writeCachedChat } from '~/services/content-cache';
import {
  clearResumeTarget,
  readResumeTarget,
} from '~/services/navigation/launch-state';

import { getChatActivityAt } from './chat-activity';
import type { ChatWithActivity } from './chat-types';

interface UseChatArchiveOptions {
  chatId: string;
  onSuccess?: () => void;
}

export function useChatArchive({ chatId, onSuccess }: UseChatArchiveOptions) {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await client.api.chats[':id'].archive.$post({ param: { id: chatId } });
      return res.json();
    },
    onSuccess: (archivedChat) => {
      if (readResumeTarget()?.id === chatId) {
        clearResumeTarget();
      }
      writeCachedChat(archivedChat);
      queryClient.setQueryData(chatKeys.activeChat(chatId), archivedChat);
      queryClient.setQueryData<ChatWithActivity[] | undefined>(
        chatKeys.archivedChats,
        (sessions) => {
          const nextArchivedChat: ChatWithActivity = {
            ...archivedChat,
            activityAt: getChatActivityAt(archivedChat),
          };

          if (!sessions) {
            return [nextArchivedChat];
          }

          return [nextArchivedChat, ...sessions.filter((session) => session.id !== chatId)];
        },
      );
      void invalidateInboxQueries(queryClient);
      onSuccess?.();
    },
  });
}

export const useArchiveChat = useChatArchive;
