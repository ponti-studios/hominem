import { CHAT_TITLE_MAX_LENGTH } from '@hominem/rpc/types';
import type { Chat, SessionSource } from '@hominem/rpc/types';
import type { QueryClient } from '@tanstack/react-query';

import { chatKeys } from '~/services/notes/query-keys';

import type { ChatWithActivity } from './session-state';

export const DEFAULT_CHAT_TITLE = 'New conversation';

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

export function normalizeChatTitle(value: string) {
  const normalized = normalizeWhitespace(value);
  return normalized.slice(0, CHAT_TITLE_MAX_LENGTH) || DEFAULT_CHAT_TITLE;
}

export function isDefaultChatTitle(title?: string | null) {
  return normalizeWhitespace(title ?? '') === DEFAULT_CHAT_TITLE;
}

function resolveSourceTitle(source: SessionSource) {
  if (source.kind === 'artifact') {
    return normalizeWhitespace(source.title) || DEFAULT_CHAT_TITLE;
  }

  if (source.kind === 'thought') {
    return normalizeChatTitle(source.preview);
  }

  return DEFAULT_CHAT_TITLE;
}

export function resolveChatScreenTitle(title: string | null | undefined, source: SessionSource) {
  if (!title || isDefaultChatTitle(title)) {
    return resolveSourceTitle(source);
  }

  return normalizeWhitespace(title) || resolveSourceTitle(source);
}

export function updateChatTitleCaches(
  queryClient: QueryClient,
  input: { chatId: string; title: string; updatedAt?: string },
) {
  const { chatId, title, updatedAt } = input;

  queryClient.setQueryData<Chat | null>(chatKeys.activeChat(chatId), (currentChat) =>
    currentChat
      ? {
          ...currentChat,
          title,
          ...(updatedAt ? { updatedAt } : null),
        }
      : currentChat,
  );

  queryClient.setQueryData<ChatWithActivity[] | undefined>(chatKeys.resumableSessions, (sessions) =>
    sessions?.map((session) =>
      session.id === chatId
        ? {
            ...session,
            title,
            ...(updatedAt ? { updatedAt, activityAt: updatedAt } : null),
          }
        : session,
    ),
  );

  queryClient.setQueryData<ChatWithActivity[] | undefined>(chatKeys.archivedSessions, (sessions) =>
    sessions?.map((session) =>
      session.id === chatId
        ? {
            ...session,
            title,
            ...(updatedAt ? { updatedAt, activityAt: updatedAt } : null),
          }
        : session,
    ),
  );
}
