import type { InboxOutput, InboxStreamItem } from '@hominem/rpc/types';
import type { InfiniteData, QueryClient } from '@tanstack/react-query';

import type { InboxStreamItemData } from '~/components/inbox/InboxStreamItem.types';
import { toThreadViewModel } from '~/components/inbox/ThreadViewModel';
import { getContentRoute } from '~/services/navigation/routes';
import { inboxKeys } from '~/services/notes/query-keys';

type InboxPageIndex = Omit<InboxOutput, 'items'> & { itemIds: string[] };
export type InboxEntityMap = Record<string, InboxStreamItemData>;

export const inboxEntityKeys = {
  all: ['inbox', 'entities'] as const,
};

function getId(item: Pick<InboxStreamItem, 'kind' | 'id'>) {
  return `${item.kind}:${item.id}`;
}

function toEntity(item: InboxStreamItem): InboxStreamItemData {
  return toThreadViewModel(item, getContentRoute(item.kind, item.entityId));
}

export function indexInboxPage(queryClient: QueryClient, page: InboxOutput): InboxPageIndex {
  queryClient.setQueryData<InboxEntityMap>(inboxEntityKeys.all, (current) => ({
    ...current,
    ...Object.fromEntries(page.items.map((item) => [getId(item), toEntity(item)])),
  }));

  return { ...page, itemIds: page.items.map(getId) };
}

export function getInboxItems(
  data: InfiniteData<InboxPageIndex, string | null> | undefined,
  entities: InboxEntityMap | undefined,
) {
  return (
    data?.pages.flatMap((page) =>
      page.itemIds
        .map((id) => entities?.[id])
        .filter((item): item is InboxStreamItemData => Boolean(item)),
    ) ?? []
  );
}

export function patchInboxEntity(
  queryClient: QueryClient,
  identity: { kind: InboxStreamItem['kind']; entityId: string },
  patch: Partial<Pick<InboxStreamItemData, 'preview' | 'title' | 'updatedAt'>>,
) {
  queryClient.setQueryData<InboxEntityMap>(inboxEntityKeys.all, (current) => {
    if (!current) {
      return current;
    }
    const id = Object.keys(current).find((key) => {
      const item = current[key];
      return item.kind === identity.kind && item.entityId === identity.entityId;
    });
    return id ? { ...current, [id]: { ...current[id], ...patch } } : current;
  });
}

export function removeInboxEntity(
  queryClient: QueryClient,
  identity: { kind: InboxStreamItem['kind']; entityId: string },
) {
  queryClient.setQueriesData<InfiniteData<InboxPageIndex, string | null>>(
    { queryKey: inboxKeys.pages() },
    (data) =>
      data && {
        ...data,
        pages: data.pages.map((page) => ({
          ...page,
          itemIds: page.itemIds.filter((id) => {
            const item = queryClient.getQueryData<InboxEntityMap>(inboxEntityKeys.all)?.[id];
            return item?.kind !== identity.kind || item.entityId !== identity.entityId;
          }),
        })),
      },
  );
}

// Puts a just-created note at the top of the first cached inbox page before
// the server has answered. Returns the entity id so it can be dropped again.
export function addOptimisticInboxNote(
  queryClient: QueryClient,
  note: { entityId: string; preview: string | null; title: string | null; updatedAt: string },
) {
  const id = `note:${note.entityId}`;
  const entity: InboxStreamItemData = {
    entityId: note.entityId,
    id,
    kind: 'note',
    preview: note.preview,
    route: getContentRoute('note', note.entityId),
    title: note.title,
    updatedAt: note.updatedAt,
    variant: 'document',
  };
  queryClient.setQueryData<InboxEntityMap>(inboxEntityKeys.all, (current) => ({
    ...current,
    [id]: entity,
  }));
  queryClient.setQueriesData<InfiniteData<InboxPageIndex, string | null>>(
    { queryKey: inboxKeys.pages() },
    (data) =>
      data && {
        ...data,
        pages: data.pages.map((page, index) =>
          index === 0 ? { ...page, itemIds: [id, ...page.itemIds] } : page,
        ),
      },
  );
  return id;
}

export interface InboxSnapshot {
  entities: InboxEntityMap | undefined;
  pages: [readonly unknown[], unknown][];
}

// The inbox is two caches -- page lists of ids and the entity map they point
// into -- so an optimistic change must capture and restore both, or a
// rollback leaves the entity map out of step with the lists.
export async function snapshotInbox(queryClient: QueryClient): Promise<InboxSnapshot> {
  await queryClient.cancelQueries({ queryKey: inboxKeys.pages() });
  return {
    entities: queryClient.getQueryData<InboxEntityMap>(inboxEntityKeys.all),
    pages: queryClient.getQueriesData({ queryKey: inboxKeys.pages() }),
  };
}

export function restoreInbox(queryClient: QueryClient, snapshot: InboxSnapshot) {
  queryClient.setQueryData(inboxEntityKeys.all, snapshot.entities);
  snapshot.pages.forEach(([queryKey, data]) => {
    queryClient.setQueryData(queryKey, data);
  });
}
