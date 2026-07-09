import { useApiClient } from '@hominem/rpc/react';
import type { InboxOutput, InboxStreamItem } from '@hominem/rpc/types';
import { useInfiniteQuery, type InfiniteData } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { InboxStreamItemData } from '~/components/inbox/InboxStreamItem.types';
import {
  appendCachedInboxItems,
  readCachedInboxSnapshot,
  replaceCachedInboxItems,
} from '~/services/inbox/cache';
import { getContentRoute } from '~/services/navigation/routes';
import { inboxKeys } from '~/services/notes/query-keys';
import {
  hasNonEmptyListData,
  resolveRestoredQueryState,
} from '~/services/query/restored-query-state';

interface UseInboxStreamItemsOptions {
  enabled?: boolean;
}

const INBOX_STREAM_STALE_TIME_MS = 30_000;

function toMobileInboxRoute(item: InboxStreamItem): string {
  return getContentRoute(item.kind, item.entityId);
}

function toInboxStreamItem(item: InboxStreamItem): InboxStreamItemData {
  return {
    id: `${item.kind}:${item.id}`,
    entityId: item.entityId,
    kind: item.kind,
    title: item.title,
    preview: item.preview,
    updatedAt: item.updatedAt,
    route: toMobileInboxRoute(item),
  };
}

export function useInboxStreamItems({ enabled = true }: UseInboxStreamItemsOptions = {}) {
  const client = useApiClient();
  const cachedSnapshot = readCachedInboxSnapshot();
  const cachedItems = cachedSnapshot.items;

  const inboxQuery = useInfiniteQuery<
    InboxOutput,
    Error,
    InfiniteData<InboxOutput, string | null>,
    readonly unknown[],
    string | null
  >({
    queryKey: inboxKeys.page({ limit: 50 }),
    initialPageParam: null,
    queryFn: async ({ pageParam }) => {
      const query: { limit: string; cursor?: string } = { limit: '50' };
      if (pageParam) query.cursor = pageParam;
      const res = await client.api.inbox.$get({ query });
      const page = (await res.json()) as InboxOutput;

      if (pageParam) {
        appendCachedInboxItems(page.items);
      } else {
        replaceCachedInboxItems(page.items);
      }

      return page;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialData:
      cachedItems.length > 0
        ? { pages: [{ items: cachedItems, nextCursor: null }], pageParams: [null] }
        : undefined,
    // Trust the cache's real age instead of forcing `0` (always-stale): a fresh
    // cache read then skips an immediate background refetch, avoiding the
    // visible reflow of cache-rendered rows being replaced moments after mount.
    initialDataUpdatedAt: cachedItems.length > 0 ? (cachedSnapshot.savedAt ?? 0) : undefined,
    staleTime: INBOX_STREAM_STALE_TIME_MS,
    enabled,
  });

  const inboxItems = useMemo(
    () => inboxQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [inboxQuery.data],
  );

  const items = useMemo(() => inboxItems.map(toInboxStreamItem), [inboxItems]);
  const restoredState = resolveRestoredQueryState({
    data: inboxItems,
    isPending: inboxQuery.isPending,
    isFetching: inboxQuery.isFetching,
    hasUsableData: hasNonEmptyListData,
  });

  return {
    items,
    error: inboxQuery.error,
    isInitialLoading: restoredState.isInitialLoading,
    isRefreshing: restoredState.isRefreshing,
    fetchNextPage: () => inboxQuery.fetchNextPage(),
    hasNextPage: inboxQuery.hasNextPage,
    isFetchingNextPage: inboxQuery.isFetchingNextPage,
    refetch: () => inboxQuery.refetch(),
  };
}
