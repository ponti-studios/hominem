import type { InboxOutput, InboxStreamItem } from '@hominem/rpc/types';
import type { InfiniteData, QueryClient } from '@tanstack/react-query';

import { removeCachedInboxItem } from '~/services/inbox/cache';
import { inboxKeys } from '~/services/notes/query-keys';

const INBOX_REFRESH_QUERY_KEYS = [inboxKeys.pages()] as const;

export async function invalidateInboxQueries(queryClient: QueryClient) {
  await Promise.all(
    INBOX_REFRESH_QUERY_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  );
}

interface InboxItemIdentity {
  kind: InboxStreamItem['kind'];
  entityId: string;
}

/**
 * Optimistically removes an item from every cached inbox page, then marks the
 * inbox query stale without forcing an immediate refetch. Reconciling via
 * invalidate+refetch alone re-fetches every already-loaded page before the
 * item visually disappears, which reads as the list flashing on delete/archive.
 */
export function removeInboxStreamItem(queryClient: QueryClient, identity: InboxItemIdentity) {
  queryClient.setQueriesData<InfiniteData<InboxOutput, string | null>>(
    { queryKey: inboxKeys.pages() },
    (data) => {
      if (!data) return data;

      return {
        ...data,
        pages: data.pages.map((page) => ({
          ...page,
          items: page.items.filter(
            (item) => !(item.kind === identity.kind && item.entityId === identity.entityId),
          ),
        })),
      };
    },
  );

  removeCachedInboxItem(identity);

  void queryClient.invalidateQueries({ queryKey: inboxKeys.pages(), refetchType: 'none' });
}
