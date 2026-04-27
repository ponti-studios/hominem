import { useApiClient } from '@hominem/rpc/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { chatKeys } from '~/services/notes/query-keys';

import { getChatActivityAt } from './session-activity';
import type { ChatWithActivity } from './session-types';

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
      queryClient.setQueryData(chatKeys.activeChat(chatId), archivedChat);
      queryClient.setQueryData<ChatWithActivity[] | undefined>(
        chatKeys.resumableSessions,
        (sessions) => sessions?.filter((session) => session.id !== chatId),
      );
      queryClient.setQueryData<ChatWithActivity[] | undefined>(
        chatKeys.archivedSessions,
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
      onSuccess?.();
    },
  });
}

export const useArchiveChat = useChatArchive;
