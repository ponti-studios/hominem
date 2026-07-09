import { useApiClient } from '@hominem/rpc/react';
import type { InboxOutput } from '@hominem/rpc/types';
import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';

import { writeCachedChat } from '~/services/content-cache';
import { removeInboxStreamItem } from '~/services/inbox/inbox-refresh';
import { clearResumeTarget, readResumeTarget } from '~/services/navigation/launch-state';
import { chatKeys, inboxKeys } from '~/services/notes/query-keys';

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
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: inboxKeys.pages() });
      const previousInboxPages = queryClient.getQueriesData<InfiniteData<InboxOutput>>({
        queryKey: inboxKeys.pages(),
      });

      removeInboxStreamItem(queryClient, { kind: 'chat', entityId: chatId });

      return { previousInboxPages };
    },
    onError: (_error, _variables, context) => {
      context?.previousInboxPages.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
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
      onSuccess?.();
    },
  });
}

export const useArchiveChat = useChatArchive;
