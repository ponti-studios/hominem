import { useMutation, useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { useCallback, useRef } from 'react';

import { getChatResponseLength } from '~/hooks/use-chat-response-length';

import { invalidateChatQueries } from './chat-cache';
import type { useChatGeneration } from './use-chat-generation';

type RegenerateInput = { messageId: string; generationId: string };

export function useRegenerateMessage(
  chatId: string,
  generationRuntime: ReturnType<typeof useChatGeneration>,
) {
  const lastMessageIdRef = useRef<string | null>(null);
  const queryClient = useQueryClient();
  const { generationRef, regenerateGeneration, setGeneration } = generationRuntime;

  const { mutateAsync } = useMutation<void, Error, RegenerateInput>({
    retry: false,
    mutationFn: async ({ messageId, generationId }) => {
      const controller = regenerateGeneration(
        {
          chatId,
          target: { messageId },
          body: { generationId, responseLength: getChatResponseLength() },
        },
        {
          id: generationId,
          chatId,
          stage: 'preparing',
          lastDurableSequence: 0,
          targetMessageId: messageId,
        },
      );
      const completed = await controller.done;
      if (completed.phase === 'failed') {
        throw new Error(completed.error ?? 'Generation failed.');
      }
    },
    onError: (error, { generationId }) => {
      if (error.name === 'AbortError') {
        return;
      }
      void invalidateChatQueries(queryClient, chatId);
      const current = generationRef.current;
      if (current?.id === generationId) {
        setGeneration({ ...current, stage: 'failed', error: error.message });
      }
    },
  });

  const regenerateMessage = useCallback(
    (messageId: string) => {
      lastMessageIdRef.current = messageId;
      const generationId = randomUUID();
      setGeneration({
        id: generationId,
        chatId,
        stage: 'preparing',
        lastDurableSequence: 0,
        targetMessageId: messageId,
      });
      void mutateAsync({ messageId, generationId }).catch(() => undefined);
    },
    [chatId, mutateAsync, setGeneration],
  );

  const retryGeneration = useCallback(() => {
    const messageId = lastMessageIdRef.current ?? generationRef.current?.targetMessageId;
    if (messageId) {
      regenerateMessage(messageId);
    }
  }, [generationRef, regenerateMessage]);

  return { regenerateMessage, retryGeneration };
}
