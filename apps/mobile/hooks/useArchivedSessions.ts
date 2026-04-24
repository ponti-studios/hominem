import { useApiClient } from '@hominem/rpc/react';
import { useQuery } from '@tanstack/react-query';

import { getArchivedChatsWithActivity } from '~/services/chat/session-lists';
import type { ChatWithActivity } from '~/services/chat/session-types';
import { chatKeys } from '~/services/notes/query-keys';

export const useArchivedSessions = () => {
  const client = useApiClient();

  return useQuery<ChatWithActivity[]>({
    queryKey: chatKeys.archivedSessions,
    queryFn: async () => {
      const res = await client.api.chats.$get({ query: { limit: '100' } });
      const chats = await res.json();
      return getArchivedChatsWithActivity(chats);
    },
  });
};
