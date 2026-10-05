import { QueryClient, type InfiniteData } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import {
  addOptimisticInboxNote,
  inboxEntityKeys,
  restoreInbox,
  snapshotInbox,
  type InboxEntityMap,
} from '~/services/inbox/inbox-entities';
import { inboxKeys } from '~/services/notes/query-keys';

type Page = { itemIds: string[]; nextCursor: string | null };

function seed(queryClient: QueryClient) {
  queryClient.setQueryData<InboxEntityMap>(inboxEntityKeys.all, {});
  queryClient.setQueryData<InfiniteData<Page, string | null>>(inboxKeys.page({ limit: 50 }), {
    pageParams: [null],
    pages: [{ itemIds: [], nextCursor: null }],
  });
}

function read(queryClient: QueryClient) {
  const data = queryClient.getQueryData<InfiniteData<Page, string | null>>(
    inboxKeys.page({ limit: 50 }),
  );
  const entities = queryClient.getQueryData<InboxEntityMap>(inboxEntityKeys.all) ?? {};
  return (data?.pages ?? []).flatMap((page) => page.itemIds.map((id) => entities[id]));
}

describe('optimistic inbox note', () => {
  it('shows the new note at the top of the list immediately', () => {
    const queryClient = new QueryClient();
    seed(queryClient);

    addOptimisticInboxNote(queryClient, {
      entityId: 'optimistic-note-1',
      preview: 'hello',
      title: null,
      updatedAt: '2026-10-05T10:00:00.000Z',
    });

    expect(read(queryClient).map((item) => item?.entityId)).toEqual(['optimistic-note-1']);
    expect(read(queryClient)[0]?.kind).toBe('note');
  });

  it('restores both the lists and the entity map on rollback', async () => {
    const queryClient = new QueryClient();
    seed(queryClient);
    const snapshot = await snapshotInbox(queryClient);

    addOptimisticInboxNote(queryClient, {
      entityId: 'optimistic-note-1',
      preview: 'hello',
      title: null,
      updatedAt: '2026-10-05T10:00:00.000Z',
    });
    restoreInbox(queryClient, snapshot);

    expect(read(queryClient)).toEqual([]);
    expect(queryClient.getQueryData<InboxEntityMap>(inboxEntityKeys.all)).toEqual({});
  });
});
