import { useApiClient } from '@hominem/rpc/react';
import type { Chat, ChatMessageDto as RpcChatMessage } from '@hominem/rpc/types';
import NetInfo from '@react-native-community/netinfo';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { useState } from 'react';

import { logger } from '@hominem/utils/logger';

import {
  createChatInboxRefreshSnapshot,
  invalidateInboxQueries,
  upsertInboxSessionActivity,
} from '../inbox/inbox-refresh';
import { chatKeys } from '../notes/query-keys';
import { createOptimisticMessage, type MessageOutput } from './chatMessages';
import { getChatActivityAt, selectChatSession, type ChatWithActivity } from './session-state';
import { updateChatTitleCaches } from './chat-title';

type SendChatMessageOutput = {
  chatTitle: string;
  metadata: {
    startTime: number;
    timestamp: string;
  };
  messages: MessageOutput[];
  function_calls: string[];
};

interface SendChatMessageInput {
  fileIds?: string[];
  message: string;
  noteIds?: string[];
}

function updateSessionCache(
  previousSessions: ChatWithActivity[] | undefined,
  snapshot: ReturnType<typeof createChatInboxRefreshSnapshot>,
) {
  return upsertInboxSessionActivity(previousSessions ?? [], snapshot);
}

function toMessageOutput(message: RpcChatMessage): MessageOutput | null {
  if (message.role === 'tool') {
    return null;
  }

  return {
    id: message.id,
    role: message.role,
    message: message.content,
    created_at: message.createdAt,
    chat_id: message.chatId,
    profile_id: '',
    focus_ids: null,
    focus_items: null,
    reasoning: message.reasoning,
    toolCalls: message.toolCalls ?? null,
    isStreaming: false,
  };
}

// Single source of truth: React Query cache
// SQLite is persistence layer only, updated after successful mutations
export const useChatMessages = ({ chatId }: { chatId: string }) => {
  const client = useApiClient();
  const _queryClient = useQueryClient();

  return useQuery<MessageOutput[]>({
    queryKey: chatKeys.messages(chatId),
    queryFn: async () => {
      const messages = await client.chats.getMessages({
        chatId,
        limit: 50,
      });

      const mapped = messages.flatMap((message) => {
        const output = toMessageOutput(message);
        return output ? [output] : [];
      });

      return mapped;
    },
    enabled: Boolean(chatId),
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });
};

type ChatSendStatus = 'idle' | 'submitted' | 'streaming' | 'error';

// Consolidated send message with optimistic updates
export const useSendMessage = ({ chatId }: { chatId: string }) => {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [sendChatError, setSendChatError] = useState(false);
  const [chatSendStatus, setChatSendStatus] = useState<ChatSendStatus>('idle');

  const mutation = useMutation<
    SendChatMessageOutput,
    Error,
    SendChatMessageInput,
    { previousMessages: MessageOutput[]; optimisticMessageId: string }
  >({
    mutationKey: ['sendChatMessage', chatId],

    // Optimistic update
    onMutate: async ({ message: messageText }) => {
      setChatSendStatus('submitted');
      const text = messageText.trim();
      if (!text) {
        return { previousMessages: [], optimisticMessageId: '' };
      }

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: chatKeys.messages(chatId) });

      // Snapshot previous value
      const previousMessages =
        queryClient.getQueryData<MessageOutput[]>(chatKeys.messages(chatId)) || [];

      // Optimistically add user message
      const optimisticMessage = createOptimisticMessage(chatId, text, generateId());
      const now = new Date().toISOString();

      queryClient.setQueryData(chatKeys.messages(chatId), [...previousMessages, optimisticMessage]);
      queryClient.setQueryData(
        chatKeys.resumableSessions,
        (previousSessions: ChatWithActivity[] | undefined) =>
          updateSessionCache(
            previousSessions,
            createChatInboxRefreshSnapshot({
              chatId,
              noteId: null,
              title: null,
              timestamp: now,
              userId: '',
            }),
          ),
      );

      return { previousMessages, optimisticMessageId: optimisticMessage.id };
    },

    mutationFn: async ({ message: messageText, fileIds, noteIds }) => {
      const status = await NetInfo.fetch();
      if (!status.isConnected) {
        throw new Error('offline_unavailable');
      }

      const payload = await client.chats.send({
        chatId,
        message: messageText.trim(),
        ...(fileIds && fileIds.length > 0 ? { fileIds } : {}),
        ...(noteIds && noteIds.length > 0 ? { noteIds } : {}),
      });
      setChatSendStatus('streaming');
      const mappedMessages = [payload.messages.user, payload.messages.assistant].flatMap(
        (message) => {
          const output = toMessageOutput(message);
          return output ? [output] : [];
        },
      );

      return {
        chatTitle: payload.chatTitle,
        metadata: payload.metadata,
        messages: mappedMessages,
        function_calls: [],
      };
    },

    // On success, update cache with server data
    onSuccess: (data, _variables, context) => {
      setSendChatError(false);
      setChatSendStatus('idle');
      const optimisticId = context?.optimisticMessageId;
      updateChatTitleCaches(queryClient, {
        chatId,
        title: data.chatTitle,
        updatedAt: data.metadata.timestamp,
      });
      queryClient.setQueryData(chatKeys.messages(chatId), (old: MessageOutput[] | undefined) => {
        const previous = old ?? [];
        const serverUserMsg = data.messages.find((m) => m.role === 'user');
        const serverAssistantMsg = data.messages.find((m) => m.role === 'assistant');

        // Replace the optimistic user message in-place, keeping its ID as the stable React key
        // so the bubble doesn't unmount/remount and re-animate.
        const reconciled = previous.map((msg) => {
          if (msg.id === optimisticId && serverUserMsg) {
            return { ...serverUserMsg, id: optimisticId };
          }
          return msg;
        });

        // Append the assistant message (it's always new).
        if (serverAssistantMsg && !reconciled.some((m) => m.id === serverAssistantMsg.id)) {
          return [...reconciled, serverAssistantMsg];
        }
        return reconciled;
      });
      void invalidateInboxQueries(queryClient);
    },

    // Rollback on error
    onError: (error, variables, context) => {
      logger.error('Error sending chat message:', error);
      setSendChatError(true);
      setChatSendStatus('error');
      if (context?.previousMessages) {
        queryClient.setQueryData(chatKeys.messages(chatId), context.previousMessages);
      }
    },
  });

  return {
    message,
    setMessage,
    sendChatError,
    setSendChatError,
    chatSendStatus,
    isChatSending: mutation.isPending,
    sendChatMessage: async (nextMessageInput: SendChatMessageInput | string = message) => {
      const resolvedInput =
        typeof nextMessageInput === 'string'
          ? { message: nextMessageInput, fileIds: [] }
          : nextMessageInput;
      const text = resolvedInput.message.trim();
      if (!text && (!resolvedInput.fileIds || resolvedInput.fileIds.length === 0)) {
        return {
          messages: [],
          function_calls: [],
        };
      }
      const result = await mutation.mutateAsync({
        message: text,
        ...(resolvedInput.fileIds && resolvedInput.fileIds.length > 0
          ? { fileIds: resolvedInput.fileIds }
          : {}),
        ...(resolvedInput.noteIds && resolvedInput.noteIds.length > 0
          ? { noteIds: resolvedInput.noteIds }
          : {}),
      });
      setMessage('');
      return result;
    },
  };
};

export const useArchiveChat = ({
  chatId,
  onSuccess,
}: {
  chatId: string;
  onSuccess: () => void;
}) => {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => client.chats.archive({ chatId }),
    onSuccess: (archivedChat) => {
      queryClient.setQueryData(chatKeys.activeChat(chatId), archivedChat);
      queryClient.setQueryData<ChatWithActivity[] | undefined>(chatKeys.resumableSessions, (sessions) =>
        sessions?.filter((session) => session.id !== chatId),
      );
      queryClient.setQueryData<ChatWithActivity[] | undefined>(chatKeys.archivedSessions, (sessions) => {
        const activityAt = getChatActivityAt(archivedChat);
        const nextArchivedChat: ChatWithActivity = {
          ...archivedChat,
          activityAt,
        };

        if (!sessions) {
          return [nextArchivedChat];
        }

        return [nextArchivedChat, ...sessions.filter((session) => session.id !== chatId)];
      });
      onSuccess();
    },
  });
};

export const useActiveChat = (chatId?: string | null) => {
  const client = useApiClient();

  return useQuery<Chat | null>({
    queryKey: chatKeys.activeChat(chatId ?? null),
    queryFn: async () => {
      if (chatId) {
        const chat = await client.chats.get({ chatId });
        const { messages: _messages, ...chatRecord } = chat;
        return chatRecord;
      }

      const chats = await client.chats.list({ limit: 50 });
      return selectChatSession(chats, chatId);
    },
  });
};

const generateId = () => randomUUID();
