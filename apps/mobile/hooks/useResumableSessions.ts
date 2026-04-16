import { useApiClient } from '@hominem/rpc/react';
import { useQuery } from '@tanstack/react-query';
import type { ChatWithActivity } from '~/services/chat/session-state';
import {
  getInboxChatsWithActivity,
} from '~/services/chat/session-state';
import { chatKeys } from '~/services/notes/query-keys';

export const useResumableSessions = () => {
  const client = useApiClient();

  return useQuery<ChatWithActivity[]>({
    queryKey: chatKeys.resumableSessions,
    queryFn: async () => {
      const chats = await client.chats.list({ limit: 50 });
      return getInboxChatsWithActivity(chats);
    },
    staleTime: 0,
  });
};
