import { streamChatWithWsFirst, toWebSocketUrl } from '@hominem/rpc';
import { useApiClient } from '@hominem/rpc/react';
import type { Chat, ChatMessageDto as RpcChatMessage } from '@hominem/rpc/types';
import type { ChatTransportPreference } from '@hominem/rpc/types';
import { logger } from '@hominem/telemetry';
import NetInfo from '@react-native-community/netinfo';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { useState } from 'react';

import { API_BASE_URL } from '~/constants';
import {
  createChatInboxRefreshSnapshot,
  invalidateInboxQueries,
  upsertInboxSessionActivity,
} from '../inbox/inbox-refresh';
import { chatKeys } from '../notes/query-keys';
import { createOptimisticMessage, type MessageOutput } from './chatMessages';
import { selectChatSession } from './session-activity';
import type { ChatWithActivity } from './session-types';

type SendChatMessageOutput = {
  assistantText: string;
};

interface SendChatMessageInput {
  fileIds?: string[];
  message: string;
  noteIds?: string[];
  referencedNotes?: RpcChatMessage['referencedNotes'];
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
    referencedNotes: message.referencedNotes ?? null,
    toolCalls: message.toolCalls ?? null,
    isStreaming: false,
  };
}

// Single source of truth: React Query cache
// Local storage is persistence layer only, updated after successful mutations
export const useChatMessages = ({ chatId }: { chatId: string }) => {
  const client = useApiClient();
  const _queryClient = useQueryClient();

  return useQuery<MessageOutput[]>({
    queryKey: chatKeys.messages(chatId),
    queryFn: async () => {
      const res = await client.api.chats[':id'].messages.$get({
        param: { id: chatId },
        query: { limit: '10' },
      });
      const messages = await res.json();

      const mapped = messages.flatMap((message) => {
        const output = toMessageOutput(message as RpcChatMessage);
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
  const transportPreference = (process.env.EXPO_PUBLIC_CHAT_TRANSPORT ||
    'auto') as ChatTransportPreference;

  const mutation = useMutation<
    SendChatMessageOutput,
    Error,
    SendChatMessageInput,
    { previousMessages: MessageOutput[]; optimisticMessageId: string }
  >({
    mutationKey: ['sendChatMessage', chatId],

    // Optimistic update
    onMutate: async ({ message: messageText, referencedNotes }) => {
      setChatSendStatus('submitted');
      const text = messageText.trim();
      if (!text && (!referencedNotes || referencedNotes.length === 0)) {
        return { previousMessages: [], optimisticMessageId: '' };
      }

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: chatKeys.messages(chatId) });

      // Snapshot previous value
      const previousMessages =
        queryClient.getQueryData<MessageOutput[]>(chatKeys.messages(chatId)) || [];

      const optimisticText =
        text || referencedNotes?.map((note) => note.title || note.id).join(', ') || '';

      // Optimistically add user message
      const optimisticMessage = createOptimisticMessage(
        chatId,
        optimisticText,
        referencedNotes ?? null,
        generateId(),
      );
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

      const wsUrl = toWebSocketUrl(API_BASE_URL, `/api/chats/${chatId}/ws`);
      const { assistantText } = await streamChatWithWsFirst({
        wsUrl,
        transportPreference,
        payload: {
          message: messageText.trim(),
          ...(fileIds && fileIds.length > 0 ? { fileIds } : {}),
          ...(noteIds && noteIds.length > 0 ? { noteIds } : {}),
        },
        onStatus: (nextStatus) => {
          if (nextStatus === 'submitted' || nextStatus === 'streaming') {
            setChatSendStatus('streaming');
            return;
          }
          if (nextStatus === 'done') {
            setChatSendStatus('idle');
          }
        },
        fallback: async () => {
          const streamRes = await client.api.chats[':id'].stream.$post({
            param: { id: chatId },
            json: {
              message: messageText.trim(),
              ...(fileIds && fileIds.length > 0 ? { fileIds } : {}),
              ...(noteIds && noteIds.length > 0 ? { noteIds } : {}),
            },
          });
          const body = streamRes.body;
          if (!body) throw new Error('No response body');

          setChatSendStatus('streaming');
          const reader = body.getReader();
          const decoder = new TextDecoder();
          let streamedAssistantText = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            streamedAssistantText += decoder.decode(value, { stream: true });
          }

          const finalChunk = decoder.decode();
          if (finalChunk) {
            streamedAssistantText += finalChunk;
          }

          return {
            assistantText: streamedAssistantText,
          };
        },
      });

      return {
        assistantText,
      };
    },

    // On success, update cache with server data
    onSuccess: (_data, _variables, context) => {
      setSendChatError(false);
      setChatSendStatus('idle');
      const optimisticId = context?.optimisticMessageId;
      queryClient.setQueryData(chatKeys.messages(chatId), (old: MessageOutput[] | undefined) => {
        const previous = old ?? [];
        const reconciled = previous.map((msg) => {
          if (msg.id === optimisticId) {
            return { ...msg, isStreaming: false };
          }
          return msg;
        });

        return reconciled;
      });
      void queryClient.invalidateQueries({ queryKey: chatKeys.messages(chatId) });
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
      if (
        !text &&
        (!resolvedInput.fileIds || resolvedInput.fileIds.length === 0) &&
        (!resolvedInput.noteIds || resolvedInput.noteIds.length === 0)
      ) {
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
        ...(resolvedInput.referencedNotes && resolvedInput.referencedNotes.length > 0
          ? { referencedNotes: resolvedInput.referencedNotes }
          : {}),
      });
      setMessage('');
      return result;
    },
  };
};

export const useActiveChat = (chatId?: string | null) => {
  const client = useApiClient();

  return useQuery<Chat | null>({
    queryKey: chatKeys.activeChat(chatId ?? null),
    queryFn: async () => {
      if (chatId) {
        const res = await client.api.chats[':id'].$get({ param: { id: chatId } });
        const chat = await res.json();
        const { messages: _messages, ...chatRecord } = chat;
        return chatRecord;
      }

      const listRes = await client.api.chats.$get({ query: { limit: '50' } });
      const chats = await listRes.json();
      return selectChatSession(chats, chatId);
    },
  });
};

const generateId = () => randomUUID();
