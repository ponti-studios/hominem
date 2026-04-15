import { parseInboxTimestamp } from '@hominem/chat';
import type { QueryClient } from '@tanstack/react-query';

import { chatKeys, noteKeys } from '~/services/notes/query-keys';

import type { ChatWithActivity } from '../chat/session-state';

const INBOX_REFRESH_QUERY_KEYS = [noteKeys.all, chatKeys.resumableSessions] as const;

interface ChatInboxRefreshSnapshot {
  chatId: string;
  noteId: string | null;
  title: string | null;
  timestamp: string;
  userId: string;
}

export function createChatInboxRefreshSnapshot(
  input: ChatInboxRefreshSnapshot,
): ChatInboxRefreshSnapshot {
  return input;
}

export function upsertInboxSessionActivity(
  sessions: ChatWithActivity[],
  snapshot: ChatInboxRefreshSnapshot,
): ChatWithActivity[] {
  const existingSession = sessions.find((session) => session.id === snapshot.chatId);
  const nextSession: ChatWithActivity = existingSession
    ? {
        ...existingSession,
        activityAt: snapshot.timestamp,
        title: snapshot.title ?? existingSession.title ?? null,
      }
    : {
        archivedAt: null,
        id: snapshot.chatId,
        createdAt: snapshot.timestamp,
        noteId: snapshot.noteId,
        title: snapshot.title ?? 'New chat',
        updatedAt: snapshot.timestamp,
        userId: snapshot.userId,
        activityAt: snapshot.timestamp,
      };

  return [...sessions.filter((session) => session.id !== snapshot.chatId), nextSession].sort(
    (left, right) =>
      parseInboxTimestamp(right.activityAt).getTime() -
      parseInboxTimestamp(left.activityAt).getTime(),
  );
}

export async function invalidateInboxQueries(queryClient: QueryClient) {
  await Promise.all(
    INBOX_REFRESH_QUERY_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  );
}
