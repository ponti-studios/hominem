import type { HonoClient } from '@hominem/rpc';
import { useApiClient } from '@hominem/rpc/react';
import { useInfiniteQuery, type InfiniteData } from '@tanstack/react-query';

import { inboxQueryKeys } from '~/lib/query-keys';

type InboxPage = Awaited<
  ReturnType<Awaited<ReturnType<HonoClient['api']['inbox']['$get']>>['json']>
>;

interface UseInboxOptions {
  initialData?: InboxPage;
}

export function useInbox(limit: number = 50, options: UseInboxOptions = {}) {
  const client = useApiClient();

  return useInfiniteQuery<
    InboxPage,
    Error,
    InfiniteData<InboxPage, string | null>,
    readonly unknown[],
    string | null
  >({
    queryKey: inboxQueryKeys.page({ limit }),
    initialPageParam: null,
    queryFn: async ({ pageParam }) => {
      const query: { limit: string; cursor?: string } = { limit: String(limit) };
      if (pageParam) query.cursor = pageParam;
      const res = await client.api.inbox.$get({ query });
      return res.json();
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 1000 * 30,
    ...(options.initialData
      ? { initialData: { pages: [options.initialData], pageParams: [null] } }
      : {}),
  });
}
