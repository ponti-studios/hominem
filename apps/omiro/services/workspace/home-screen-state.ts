import type { InboxStreamItemData } from '~/components/workspace/InboxStreamItem.types';

export type WorkspaceHomeTab = 'chats' | 'notes';

export interface WorkspaceHomeSections {
  chatItems: InboxStreamItemData[];
  noteItems: InboxStreamItemData[];
  visibleItems: InboxStreamItemData[];
  searchResults: InboxStreamItemData[];
}

function matchesQuery(item: InboxStreamItemData, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return [item.title, item.preview].some((value) => value?.toLowerCase().includes(normalizedQuery));
}

function byKind(items: InboxStreamItemData[], kind: InboxStreamItemData['kind']) {
  return items.filter((item) => item.kind === kind);
}

export function buildWorkspaceHomeSections({
  items,
  tab,
  searchQuery,
}: {
  items: InboxStreamItemData[];
  tab: WorkspaceHomeTab;
  searchQuery: string;
}): WorkspaceHomeSections {
  const chatItems = byKind(items, 'chat');
  const noteItems = byKind(items, 'note');
  const searchResults = items.filter((item) => matchesQuery(item, searchQuery));

  return {
    chatItems,
    noteItems,
    visibleItems: tab === 'notes' ? noteItems : chatItems,
    searchResults,
  };
}
