import type { InboxStreamItemData } from '~/components/inbox/InboxStreamItem.types';

export type InboxTab = 'chats' | 'notes';

export interface InboxSections {
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

export function buildInboxSections({
  items,
  tab,
  searchQuery,
}: {
  items: InboxStreamItemData[];
  tab: InboxTab;
  searchQuery: string;
}): InboxSections {
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
