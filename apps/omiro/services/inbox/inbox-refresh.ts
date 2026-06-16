import type { QueryClient } from '@tanstack/react-query';

import { inboxKeys } from '~/services/notes/query-keys';

const INBOX_REFRESH_QUERY_KEYS = [inboxKeys.pages()] as const;

export async function invalidateInboxQueries(queryClient: QueryClient) {
  await Promise.all(
    INBOX_REFRESH_QUERY_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  );
}
