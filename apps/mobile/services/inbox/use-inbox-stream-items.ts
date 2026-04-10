import { useMemo } from 'react';

import type { InboxStreamItemData } from '~/components/workspace/inbox-stream-items';
import { useResumableSessions } from '~/components/chat/session-card';
import { useNoteStream } from '~/services/notes/use-note-stream';

export function useInboxStreamItems() {
  const { data: chats = [], isLoading: isLoadingChats, refetch: refetchChats } = useResumableSessions();
  const notesQuery = useNoteStream();
  const notes = notesQuery.data ?? [];

  const items = useMemo(() => {
    const chatItems: InboxStreamItemData[] = chats.map((chat) => ({
      id: `chat:${chat.id}`,
      kind: 'chat',
      title: chat.title,
      preview: null,
      updatedAt: chat.activityAt,
      route: `/(protected)/(tabs)/chat/${chat.id}`,
    }));

    const noteItems: InboxStreamItemData[] = notes.map((note) => ({
      id: `note:${note.id}`,
      kind: 'note',
      title: note.title,
      preview: note.excerpt ?? note.content,
      updatedAt: note.updatedAt,
      route: `/(protected)/(tabs)/notes/${note.id}`,
    }));

    return [...chatItems, ...noteItems].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [chats, notes]);

  return {
    items,
    isLoading: isLoadingChats || notesQuery.isLoading,
    refetch: async () => {
      await Promise.all([refetchChats(), notesQuery.refetch()]);
    },
  };
}
