import type { Chat } from '@hominem/rpc/types';

export function getChatActivityAt(chat: Chat): string {
  return chat.updatedAt ?? chat.createdAt;
}

export function selectChatSession(chats: Chat[], requestedChatId?: string | null): Chat | null {
  if (requestedChatId) {
    return chats.find((chat) => chat.id === requestedChatId) ?? null;
  }

  return chats.find((chat) => !chat.archivedAt) ?? null;
}
