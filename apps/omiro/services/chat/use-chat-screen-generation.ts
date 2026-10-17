import type { GenerationClientInputEvent } from '@hominem/chat/client';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { useAuth } from '~/services/auth/auth-provider';

import { handleChatGenerationEvent, invalidateChatQueries } from './chat-cache';
import type { ChatGenerationState } from './chat-generation';
import { useChatGeneration } from './use-chat-generation';
import { useRegenerateMessage } from './use-regenerate-message';
import { useSendMessage } from './use-send-message';
import { useToolCallRespond } from './use-tool-call-respond';

export function useChatScreenGeneration(chatId: string) {
  const queryClient = useQueryClient();
  const { getAuthHeaders } = useAuth();
  const onGenerationTerminal = useCallback(
    async (event?: GenerationClientInputEvent) => {
      if (
        event &&
        'payload' in event &&
        (event.type === 'generation.committed' || event.type === 'generation.cancelled')
      ) {
        return;
      }
      await invalidateChatQueries(queryClient, chatId);
    },
    [chatId, queryClient],
  );
  const onGenerationEvent = useCallback(
    (event: GenerationClientInputEvent, generation: ChatGenerationState) =>
      handleChatGenerationEvent({ queryClient, chatId, generation, event }),
    [chatId, queryClient],
  );
  const generationRuntime = useChatGeneration({
    chatId,
    getAuthHeaders,
    onGenerationTerminal,
    onGenerationEvent,
  });
  const sending = useSendMessage({ chatId, generation: generationRuntime });
  const toolCall = useToolCallRespond({ chatId, generation: generationRuntime });
  const regeneration = useRegenerateMessage(chatId, generationRuntime);

  return {
    cancelGeneration: sending.cancelGeneration,
    dismissGeneration: sending.dismissGeneration,
    generation: sending.generation,
    isChatSending: sending.isChatSending,
    isRespondingToToolCall: toolCall.isResponding,
    regenerateMessage: regeneration.regenerateMessage,
    respondToolCall: toolCall.respond,
    retryActiveGeneration: sending.generation?.targetMessageId
      ? regeneration.retryGeneration
      : sending.retryLastGeneration,
    retryFailedMessage: sending.retryLastGeneration,
    sendChatMessage: sending.sendChatMessage,
  };
}
