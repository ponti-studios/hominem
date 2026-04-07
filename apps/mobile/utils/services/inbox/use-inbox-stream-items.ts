import { useMemo } from 'react';

import { useResumableSessions } from '~/components/chat/session-card';
import type { InboxStreamItemData } from '~/components/workspace/inbox-stream-items';
import { useNoteStream } from '~/utils/services/notes/use-note-stream';

export function useInboxStreamItems() {
  const notes = useNoteStream();
  const sessions = useResumableSessions();

  const items = useMemo<InboxStreamItemData[]>(() => {
    const noteItems: InboxStreamItemData[] = (notes.data ?? []).map((note) => ({
      kind: 'note',
      id: note.id,
      title: note.title ?? 'Untitled',
      preview: note.excerpt ?? note.content ?? null,
      updatedAt: note.updatedAt,
      route: `/(protected)/(tabs)/notes/${note.id}`,
    }));

    const chatItems: InboxStreamItemData[] = (sessions.data ?? []).map((chat) => ({
      kind: 'chat',
      id: chat.id,
      title: chat.title ?? 'Untitled chat',
      preview: null,
      updatedAt: chat.activityAt,
      route: `/(protected)/(tabs)/chat/${chat.id}`,
    }));

    return [...noteItems, ...chatItems].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }, [notes.data, sessions.data]);

  return {
    items,
    isLoading: notes.isLoading || sessions.isLoading,
    refetch: async () => {
      await Promise.all([notes.refetch(), sessions.refetch()]);
    },
  };
}
