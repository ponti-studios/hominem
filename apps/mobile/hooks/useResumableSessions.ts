import { useApiClient } from '@hominem/rpc/react';
import { useQuery } from '@tanstack/react-query';

import { getInboxChatsWithActivity } from '~/services/chat/session-lists';
import type { ChatWithActivity } from '~/services/chat/session-types';
import { chatKeys } from '~/services/notes/query-keys';

interface UseResumableSessionsOptions {
  enabled?: boolean;
}

const RESUMABLE_SESSIONS_STALE_TIME_MS = 30_000;

export const useResumableSessions = ({ enabled = true }: UseResumableSessionsOptions = {}) => {
  const client = useApiClient();

  return useQuery<ChatWithActivity[]>({
    queryKey: chatKeys.resumableSessions,
    queryFn: async () => {
      const res = await client.api.chats.$get({ query: { limit: '50' } });
      const chats = await res.json();
      return getInboxChatsWithActivity(chats);
    },
    enabled,
    staleTime: RESUMABLE_SESSIONS_STALE_TIME_MS,
  });
};
