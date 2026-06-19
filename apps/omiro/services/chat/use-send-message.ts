import NetInfo from '@react-native-community/netinfo';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { useCallback, useRef } from 'react';

import { API_BASE_URL } from '~/constants';
import { useAuth } from '~/services/auth/auth-provider';
import { chatKeys, inboxKeys } from '~/services/notes/query-keys';
import { writeCachedChatMessages } from '~/services/workspace/content-cache';

import { createOptimisticMessage, type MessageOutput } from './chatMessages';
import { streamSSE } from './stream-sse';

// Batch chunk writes at ~2 frames (60 fps) to avoid a setQueryData per token.
const FLUSH_INTERVAL_MS = 32;

export interface SendInput {
  message: string;
  fileIds?: string[];
  noteIds?: string[];
}

function createStreamingPlaceholder(chatId: string, id: string): MessageOutput {
  return {
    id,
    role: 'assistant',
    message: '',
    created_at: new Date().toISOString(),
    chat_id: chatId,
    profile_id: '',
    focus_ids: null,
    focus_items: null,
    reasoning: null,
    referencedNotes: null,
    toolCalls: null,
    isStreaming: true,
  };
}

export function useSendMessage({ chatId }: { chatId: string }) {
  const { getAuthHeaders } = useAuth();
  const queryClient = useQueryClient();

  const streamingIdRef = useRef<string | null>(null);
  const chunkBufferRef = useRef('');
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistMessages = useCallback(() => {
    const messages = queryClient.getQueryData<MessageOutput[]>(chatKeys.messages(chatId));
    if (messages) {
      writeCachedChatMessages(chatId, messages);
    }
  }, [chatId, queryClient]);

  const writeBuffer = useCallback(() => {
    const id = streamingIdRef.current;
    const buffer = chunkBufferRef.current;
    if (!id || !buffer) return;
    chunkBufferRef.current = '';
    queryClient.setQueryData<MessageOutput[]>(chatKeys.messages(chatId), (prev) =>
      prev?.map((m) => (m.id === id ? { ...m, message: m.message + buffer } : m)),
    );
    persistMessages();
  }, [chatId, persistMessages, queryClient]);

  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current !== null) return;
    flushTimerRef.current = setTimeout(() => {
      flushTimerRef.current = null;
      writeBuffer();
    }, FLUSH_INTERVAL_MS);
  }, [writeBuffer]);

  const flushNow = useCallback(() => {
    if (flushTimerRef.current !== null) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    writeBuffer();
  }, [writeBuffer]);

  const onChunk = useCallback(
    (chunk: string) => {
      chunkBufferRef.current += chunk;
      scheduleFlush();
    },
    [scheduleFlush],
  );

  const mutation = useMutation<
    void,
    Error,
    SendInput,
    { previousMessages: MessageOutput[]; assistantMsgId: string }
  >({
    onMutate: async ({ message }) => {
      await queryClient.cancelQueries({ queryKey: chatKeys.messages(chatId) });
      const previousMessages =
        queryClient.getQueryData<MessageOutput[]>(chatKeys.messages(chatId)) ?? [];

      const userMsgId = randomUUID();
      const assistantMsgId = randomUUID();
      streamingIdRef.current = assistantMsgId;
      chunkBufferRef.current = '';

      queryClient.setQueryData<MessageOutput[]>(chatKeys.messages(chatId), [
        ...previousMessages,
        createOptimisticMessage(chatId, message, null, userMsgId),
        createStreamingPlaceholder(chatId, assistantMsgId),
      ]);
      persistMessages();

      return { previousMessages, assistantMsgId };
    },

    mutationFn: async ({ message, fileIds, noteIds }) => {
      const net = await NetInfo.fetch();
      if (net.isConnected === false) throw new Error('offline_unavailable');

      await streamSSE({
        url: `${API_BASE_URL}/api/chats/${chatId}/stream`,
        payload: { message: message.trim(), fileIds, noteIds },
        getHeaders: getAuthHeaders,
        onChunk,
      });

      flushNow();
    },

    onSuccess: (_data, _input, context) => {
      streamingIdRef.current = null;
      queryClient.setQueryData<MessageOutput[]>(chatKeys.messages(chatId), (prev) =>
        prev?.map((m) => (m.id === context?.assistantMsgId ? { ...m, isStreaming: false } : m)),
      );
      persistMessages();
      // Background refresh to replace client-generated IDs with server IDs.
      void queryClient.invalidateQueries({ queryKey: chatKeys.messages(chatId) });
      void queryClient.invalidateQueries({ queryKey: inboxKeys.pages() });
    },

    onError: (_error, _input, context) => {
      streamingIdRef.current = null;
      flushNow();
      if (context?.previousMessages) {
        queryClient.setQueryData(chatKeys.messages(chatId), context.previousMessages);
        persistMessages();
      }
    },
  });

  const sendChatMessage = useCallback(
    async (input: SendInput): Promise<void> => {
      if (!input.message.trim()) return;
      await mutation.mutateAsync(input);
    },
    [mutation],
  );

  return {
    isChatSending: mutation.isPending,
    sendChatError: mutation.isError,
    sendChatMessage,
  };
}
