import type { ChatMessageItem } from '@hominem/chat';
import { useApiClient } from '@hominem/rpc/react';
import type { Chat, ChatMessageDto as RpcChatMessage } from '@hominem/rpc/types';
import { useQuery } from '@tanstack/react-query';

import { chatKeys } from '../notes/query-keys';

export const CHAT_MESSAGES_LIMIT = 50;

export function toMessageOutput(message: RpcChatMessage): ChatMessageItem | null {
  if (message.role === 'tool') {
    return null;
  }

  const audioFile = message.files?.find((file) => file.type === 'audio');

  return {
    id: message.id,
    renderKey: message.id,
    role: message.role,
    message: message.content,
    createdAt: message.createdAt,
    chatId: message.chatId,
    reasoning: message.reasoning,
    toolCalls: message.toolCalls ?? null,
    isStreaming: false,
    audio:
      audioFile?.url && audioFile.mimeType
        ? { url: audioFile.url, mimeType: audioFile.mimeType }
        : null,
  };
}

export const useChatMessages = ({ chatId }: { chatId: string }) => {
  const client = useApiClient();
  return useQuery<ChatMessageItem[]>({
    queryKey: chatKeys.messages(chatId),
    queryFn: async () => {
      const res = await client.api.chats[':id'].messages.$get({
        param: { id: chatId },
        query: { limit: String(CHAT_MESSAGES_LIMIT) },
      });
      const messages = await res.json();

      return messages.flatMap((message: RpcChatMessage) => {
        const output = toMessageOutput(message);
        return output ? [output] : [];
      });
    },
    enabled: Boolean(chatId),
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });
};

export const useActiveChat = (chatId?: string | null) => {
  const client = useApiClient();
  const activeChatId = chatId ?? '';
  return useQuery<Chat | null>({
    queryKey: chatKeys.activeChat(activeChatId || null),
    queryFn: async () => {
      const res = await client.api.chats[':id'].$get({ param: { id: activeChatId } });
      const chat = await res.json();
      const { messages: _messages, ...chatRecord } = chat;
      return chatRecord;
    },
    enabled: Boolean(chatId),
  });
};
