import type { InboxOutput } from '@hominem/rpc/react';
import { useApiClient } from '@hominem/rpc/react';
import { useInfiniteQuery, type InfiniteData } from '@tanstack/react-query';

import { inboxQueryKeys } from '~/lib/query-keys';

interface UseInboxOptions {
  initialData?: InboxOutput;
}

export function useInbox(limit: number = 50, options: UseInboxOptions = {}) {
  const client = useApiClient();

  return useInfiniteQuery<
    InboxOutput,
    Error,
    InfiniteData<InboxOutput, string | null>,
    readonly unknown[],
    string | null
  >({
    queryKey: inboxQueryKeys.page({ limit }),
    initialPageParam: null,
    queryFn: async ({ pageParam }) => {
      const query: { limit: string; cursor?: string } = { limit: String(limit) };
      if (pageParam) query.cursor = pageParam;
      const res = await client.api.inbox.$get({ query });
      return res.json() as Promise<InboxOutput>;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 1000 * 30,
    ...(options.initialData
      ? { initialData: { pages: [options.initialData], pageParams: [null] } }
      : {}),
  });
}
