import NetInfo from '@react-native-community/netinfo';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { useCallback, useRef } from 'react';

import type { ChatMessageItem } from '~/components/chat';
import { getChatResponseLength } from '~/hooks/use-chat-response-length';
import { chatKeys } from '~/services/notes/query-keys';

import { getCachedMessageIds } from './chat-cache';
import { OFFLINE_UNAVAILABLE_ERROR } from './chat-errors';
import { beginLiveTurn, dropLiveReply } from './live-turn-store';
import type { useChatGeneration } from './use-chat-generation';

function fallbackId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createOptimisticMessage(
  chatId: string,
  messageText: string,
  id = fallbackId(),
): ChatMessageItem {
  return {
    id,
    renderKey: id,
    role: 'user',
    message: messageText,
    createdAt: new Date().toISOString(),
    chatId,
    reasoning: null,
    toolCalls: null,
    isStreaming: false,
  };
}

export interface SendInput {
  message: string;
  fileIds?: string[];
  responseModality?: 'text' | 'audio';
}

type MutationInput = SendInput & { generationId: string };
type SendContext = { userMessageId: string };

export function useSendMessage({
  chatId,
  generation: generationRuntime,
}: {
  chatId: string;
  generation: ReturnType<typeof useChatGeneration>;
}) {
  const queryClient = useQueryClient();
  const lastInputRef = useRef<SendInput | null>(null);
  const {
    dismissGeneration,
    generation,
    generationRef,
    regenerateGeneration,
    sendGeneration,
    setGeneration,
  } = generationRuntime;

  const { mutateAsync, isPending } = useMutation<void, Error, MutationInput, SendContext>({
    mutationKey: ['chat-generation', chatId],
    retry: false,
    onMutate: async ({ message, generationId }) => {
      await queryClient.cancelQueries({ queryKey: chatKeys.messages(chatId) });
      const userMessageId = randomUUID();
      // The optimistic message lives in the live turn, not the query cache, so a
      // refetch can neither drop it nor show it twice next to the server's copy.
      beginLiveTurn(chatId, {
        generationId,
        knownIds: getCachedMessageIds(queryClient, chatId),
        user: createOptimisticMessage(chatId, message, userMessageId),
      });
      setGeneration({
        id: generationId,
        chatId,
        stage: 'preparing',
        lastDurableSequence: 0,
        userMessageId,
      });
      return { userMessageId };
    },
    mutationFn: async ({ generationId, message, fileIds, responseModality }) => {
      const net = await NetInfo.fetch();
      if (net.isConnected === false) {
        const current = generationRef.current;
        if (current?.id === generationId) {
          setGeneration({
            ...current,
            retryInput: {
              message,
              ...(fileIds ? { fileIds } : {}),
              ...(responseModality ? { responseModality } : {}),
            },
          });
        }
        throw new Error(OFFLINE_UNAVAILABLE_ERROR);
      }

      const controller = sendGeneration(
        {
          chatId,
          generationId,
          message: message.trim(),
          fileIds,
          responseModality,
          responseLength: getChatResponseLength(),
        },
        {
          id: generationId,
          chatId,
          stage: 'preparing',
          lastDurableSequence: 0,
          userMessageId: generationRef.current?.userMessageId,
        },
      );
      const completed = await controller.done;
      if (completed.phase === 'failed') {
        throw new Error(completed.error ?? 'Generation failed.');
      }
    },
    onError: (error, input) => {
      // Failed before (or without) a terminal event: the placeholder must not outlive the send.
      dropLiveReply(chatId, input.generationId);
      const current = generationRef.current;
      if (
        current?.id === input.generationId &&
        current.stage !== 'stopping' &&
        error.name !== 'AbortError'
      ) {
        setGeneration({
          ...current,
          stage: 'failed',
          error: error.message,
          ...(current.lastDurableSequence === 0
            ? {
                retryInput: {
                  message: input.message,
                  ...(input.fileIds ? { fileIds: input.fileIds } : {}),
                  ...(input.responseModality ? { responseModality: input.responseModality } : {}),
                },
              }
            : {}),
        });
      }
    },
  });

  const sendChatMessage = useCallback(
    (input: SendInput) => {
      lastInputRef.current = input;
      return mutateAsync({ ...input, generationId: randomUUID() });
    },
    [mutateAsync],
  );

  const retryLastGeneration = useCallback(() => {
    const failed = generationRef.current;
    if (failed?.stage === 'failed' && failed.retryInput) {
      const retryInput = failed.retryInput;
      setGeneration(null);
      void sendChatMessage(retryInput).catch(() => undefined);
      return;
    }
    // A failed attempt already has its user message persisted server-side —
    // redo it in place via regenerate rather than resending, which would
    // insert a duplicate user message.
    if (failed?.stage === 'failed' && failed.userMessageId) {
      const generationId = randomUUID();
      setGeneration({
        id: generationId,
        chatId,
        stage: 'preparing',
        lastDurableSequence: 0,
        userMessageId: failed.userMessageId,
      });
      const controller = regenerateGeneration(
        {
          chatId,
          target: { generationId: failed.id },
          body: { generationId, responseLength: getChatResponseLength() },
        },
        {
          id: generationId,
          chatId,
          stage: 'preparing',
          lastDurableSequence: 0,
          userMessageId: failed.userMessageId,
        },
      );
      void controller.done.catch(() => undefined);
      return;
    }
    if (lastInputRef.current) {
      void sendChatMessage(lastInputRef.current).catch(() => undefined);
    }
  }, [chatId, generationRef, queryClient, regenerateGeneration, sendChatMessage, setGeneration]);

  return {
    cancelGeneration: generationRuntime.cancelGeneration,
    dismissGeneration,
    generation,
    isChatSending: isPending,
    retryLastGeneration,
    sendChatMessage,
  };
}
