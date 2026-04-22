import { useApiClient } from '@hominem/rpc/react';
import { useQuery } from '@tanstack/react-query';

import type { ChatWithActivity } from '~/services/chat/session-state';
import { getArchivedChatsWithActivity } from '~/services/chat/session-state';
import { chatKeys } from '~/services/notes/query-keys';

export const useArchivedSessions = () => {
  const client = useApiClient();

  return useQuery<ChatWithActivity[]>({
    queryKey: chatKeys.archivedSessions,
    queryFn: async () => {
      const chats = await client.chats.list({ limit: 100 });
      return getArchivedChatsWithActivity(chats);
    },
  });
};
