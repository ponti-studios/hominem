import { useApiClient } from '@hominem/rpc/react';
import { useQuery } from '@tanstack/react-query';

import { getInboxChatsWithActivity } from '~/services/chat/session-lists';
import type { ChatWithActivity } from '~/services/chat/session-types';
import { chatKeys } from '~/services/notes/query-keys';

export const useResumableSessions = () => {
  const client = useApiClient();

  return useQuery<ChatWithActivity[]>({
    queryKey: chatKeys.resumableSessions,
    queryFn: async () => {
      const res = await client.api.chats.$get({ query: { limit: '50' } });
      const chats = await res.json();
      return getInboxChatsWithActivity(chats);
    },
    staleTime: 0,
  });
};
