import { useMemo } from 'react';

import { useChatsList } from './use-chats';
import { useNotesList } from './use-notes';

export type InboxStreamItem = {
  kind: 'note' | 'chat';
  id: string;
  title: string | null;
  preview: string | null;
  updatedAt: string;
};

export function useInboxStream(): {
  items: InboxStreamItem[];
  isLoading: boolean;
} {
  const notesQuery = useNotesList();
  const chatsQuery = useChatsList();

  const items = useMemo(() => {
    const noteItems = (notesQuery.data ?? []).map<InboxStreamItem>((note) => ({
      kind: 'note',
      id: note.id,
      title: note.title,
      preview: note.excerpt ?? note.content ?? null,
      updatedAt: note.updatedAt,
    }));
    const chatItems = (chatsQuery.data ?? []).map<InboxStreamItem>((chat) => ({
      kind: 'chat',
      id: chat.id,
      title: chat.title,
      preview: null,
      updatedAt: chat.updatedAt,
    }));

    return [...noteItems, ...chatItems].sort(
      (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
    );
  }, [chatsQuery.data, notesQuery.data]);

  return {
    items,
    isLoading: notesQuery.isLoading || chatsQuery.isLoading,
  };
}
