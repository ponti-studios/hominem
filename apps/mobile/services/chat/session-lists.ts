import { parseInboxTimestamp } from '@hominem/chat';
import type { Chat } from '@hominem/rpc/types';
import { TIME_UNITS } from '@hominem/utils/time';

import { getChatActivityAt } from './session-activity';
import type { ChatWithActivity } from './session-types';

function parseChatActivityAt(chat: Chat): Date {
  return parseInboxTimestamp(getChatActivityAt(chat));
}

function isChatResumable(chat: Chat, now = Date.now()): boolean {
  return now - parseChatActivityAt(chat).getTime() <= TIME_UNITS.MONTH;
}

function toChatsWithActivity(chats: Chat[], now = Date.now()): ChatWithActivity[] {
  return chats
    .map((chat) => ({
      ...chat,
      activityAt: getChatActivityAt(chat),
    }))
    .filter((chat) => isChatResumable(chat, now))
    .sort(
      (a, b) =>
        parseInboxTimestamp(b.activityAt).getTime() - parseInboxTimestamp(a.activityAt).getTime(),
    );
}

export function getInboxChatsWithActivity(chats: Chat[], now = Date.now()): ChatWithActivity[] {
  return toChatsWithActivity(chats, now).filter((chat) => !chat.archivedAt);
}

export function getArchivedChatsWithActivity(chats: Chat[], now = Date.now()): ChatWithActivity[] {
  return toChatsWithActivity(chats, now).filter((chat) => Boolean(chat.archivedAt));
}
