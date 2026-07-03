import { describe, expect, it } from 'vitest';

import type { InboxStreamItemData } from '~/components/inbox/InboxStreamItem.types';
import { buildInboxSections } from '~/services/inbox/screen-state';

const ITEMS: InboxStreamItemData[] = [
  {
    id: 'chat:1',
    entityId: 'chat-1',
    kind: 'chat',
    title: 'App design iteration tips',
    preview: 'Let us explore the current inbox layout',
    updatedAt: '2026-06-20T10:00:00.000Z',
    route: '/(protected)/inbox/chat/chat-1',
  },
  {
    id: 'note:1',
    entityId: 'note-1',
    kind: 'note',
    title: 'Visual style concept',
    preview: 'Notes about the redesign direction',
    updatedAt: '2026-06-20T09:00:00.000Z',
    route: '/(protected)/inbox/note/note-1',
  },
  {
    id: 'chat:2',
    entityId: 'chat-2',
    kind: 'chat',
    title: 'Reality TV game design',
    preview: 'ChatGPT-inspired navigation ideas',
    updatedAt: '2026-06-20T08:00:00.000Z',
    route: '/(protected)/inbox/chat/chat-2',
  },
];

describe('buildInboxSections', () => {
  it('derives chat and note lists from the inbox payload', () => {
    const result = buildInboxSections({
      items: ITEMS,
      tab: 'chats',
      searchQuery: '',
    });

    expect(result.chatItems.map((item) => item.id)).toEqual(['chat:1', 'chat:2']);
    expect(result.noteItems.map((item) => item.id)).toEqual(['note:1']);
  });

  it('selects visible items from the active tab', () => {
    const chatsResult = buildInboxSections({
      items: ITEMS,
      tab: 'chats',
      searchQuery: '',
    });
    const notesResult = buildInboxSections({
      items: ITEMS,
      tab: 'notes',
      searchQuery: '',
    });

    expect(chatsResult.visibleItems.map((item) => item.id)).toEqual(['chat:1', 'chat:2']);
    expect(notesResult.visibleItems.map((item) => item.id)).toEqual(['note:1']);
  });

  it('searches across loaded notes and chats regardless of active tab', () => {
    const result = buildInboxSections({
      items: ITEMS,
      tab: 'notes',
      searchQuery: 'design',
    });

    expect(result.searchResults.map((item) => item.id)).toEqual(['chat:1', 'note:1', 'chat:2']);
  });
});
