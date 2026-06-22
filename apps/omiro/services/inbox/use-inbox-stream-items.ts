import { useApiClient } from '@hominem/rpc/react';
import type { InboxOutput, InboxStreamItem } from '@hominem/rpc/types';
import { useInfiniteQuery, type InfiniteData } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { InboxStreamItemData } from '~/components/workspace/InboxStreamItem.types';
import {
  appendCachedInboxItems,
  readCachedInboxItems,
  replaceCachedInboxItems,
} from '~/services/inbox/cache';
import { inboxKeys } from '~/services/notes/query-keys';
import { updateStartupContext } from '~/services/performance/startup-metrics';
import {
  hasNonEmptyListData,
  resolveRestoredQueryState,
} from '~/services/query/restored-query-state';
import { getWorkspaceArtifactRoute } from '~/services/workspace/routes';

interface UseInboxStreamItemsOptions {
  enabled?: boolean;
}

const INBOX_STREAM_STALE_TIME_MS = 30_000;

function toMobileInboxRoute(item: InboxStreamItem): string {
  return getWorkspaceArtifactRoute(item.kind, item.entityId);
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
  const cachedItems = readCachedInboxItems();

  updateStartupContext({
    inboxCacheHit: cachedItems.length > 0,
    inboxItemCount: cachedItems.length,
  });

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
    initialDataUpdatedAt: cachedItems.length > 0 ? 0 : undefined,
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
