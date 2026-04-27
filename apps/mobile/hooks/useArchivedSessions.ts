import { useApiClient } from '@hominem/rpc/react';
import { useQuery } from '@tanstack/react-query';

import { getArchivedChatsWithActivity } from '~/services/chat/session-lists';
import type { ChatWithActivity } from '~/services/chat/session-types';
import { chatKeys } from '~/services/notes/query-keys';

interface UseArchivedSessionsOptions {
  enabled?: boolean;
}

const ARCHIVED_SESSIONS_STALE_TIME_MS = 5 * 60_000;

export const useArchivedSessions = ({ enabled = true }: UseArchivedSessionsOptions = {}) => {
  const client = useApiClient();

  return useQuery<ChatWithActivity[]>({
    queryKey: chatKeys.archivedSessions,
    queryFn: async () => {
      const res = await client.api.chats.$get({ query: { limit: '100' } });
      const chats = await res.json();
      return getArchivedChatsWithActivity(chats);
    },
    enabled,
    staleTime: ARCHIVED_SESSIONS_STALE_TIME_MS,
  });
};
