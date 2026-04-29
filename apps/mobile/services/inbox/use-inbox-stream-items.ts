import { useMemo } from 'react';

import { useApiClient } from '@hominem/rpc/react';
import type { InboxOutput, InboxStreamItem } from '@hominem/rpc/types';
import { useQuery } from '@tanstack/react-query';

import type { InboxStreamItemData } from '~/components/workspace/InboxStreamItem.types';
import { inboxKeys } from '~/services/notes/query-keys';

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

  const inboxQuery = useQuery<InboxOutput>({
    queryKey: inboxKeys.all,
    queryFn: async () => {
      const res = await client.api.inbox.$get({ query: { limit: '50' } });
      return res.json();
    },
    staleTime: INBOX_STREAM_STALE_TIME_MS,
    enabled,
  });

  const inboxItems = inboxQuery.data?.items ?? [];
  const items = useMemo(() => inboxItems.map(toInboxStreamItem), [inboxItems]);

  return {
    items,
    isLoading: inboxQuery.isLoading,
    refetch: () => inboxQuery.refetch(),
  };
}
