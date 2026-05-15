import { useApiClient } from '@hominem/rpc/react';
import type { InboxOutput, InboxStreamItem } from '@hominem/rpc/types';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { InboxStreamItemData } from '~/components/workspace/InboxStreamItem.types';
import { readCachedInboxItems, writeCachedInboxItems } from '~/services/inbox/cache';
import { inboxKeys } from '~/services/notes/query-keys';
import { updateStartupContext } from '~/services/performance/startup-metrics';
import {
  hasNonEmptyListData,
  resolveRestoredQueryState,
} from '~/services/query/restored-query-state';

interface UseInboxStreamItemsOptions {
  enabled?: boolean;
}

const INBOX_STREAM_STALE_TIME_MS = 30_000;

function toInboxStreamItem(item: InboxStreamItem): InboxStreamItemData {
  return {
    id: `${item.kind}:${item.id}`,
    entityId: item.entityId,
    kind: item.kind,
    title: item.title,
    preview: item.preview,
    updatedAt: item.updatedAt,
    route: item.route,
  };
}

export function useInboxStreamItems({ enabled = true }: UseInboxStreamItemsOptions = {}) {
  const client = useApiClient();
  const cachedItems = readCachedInboxItems();

  updateStartupContext({
    inboxCacheHit: cachedItems.length > 0,
    inboxItemCount: cachedItems.length,
  });

  const inboxQuery = useQuery<InboxOutput>({
    queryKey: inboxKeys.all,
    queryFn: async () => {
      const res = await client.api.inbox.$get({ query: { limit: '50' } });
      const inbox = await res.json();
      writeCachedInboxItems(inbox.items);
      return inbox;
    },
    initialData: cachedItems.length > 0 ? { items: cachedItems } : undefined,
    staleTime: INBOX_STREAM_STALE_TIME_MS,
    enabled,
  });

  const inboxItems = inboxQuery.data?.items ?? [];
  const items = useMemo(() => inboxItems.map(toInboxStreamItem), [inboxItems]);
  const restoredState = resolveRestoredQueryState({
    data: inboxQuery.data?.items,
    isPending: inboxQuery.isPending,
    isFetching: inboxQuery.isFetching,
    hasUsableData: hasNonEmptyListData,
  });

  return {
    items,
    isInitialLoading: restoredState.isInitialLoading,
    isRefreshing: restoredState.isRefreshing,
    refetch: () => inboxQuery.refetch(),
  };
}
