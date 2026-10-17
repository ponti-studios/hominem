import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { invalidateChatQueries } from './chat-cache';
import type { useChatGeneration } from './use-chat-generation';

export function useToolCallRespond({
  chatId,
  generation,
}: {
  chatId: string;
  generation: ReturnType<typeof useChatGeneration>;
}) {
  const queryClient = useQueryClient();
  const [isResponding, setIsResponding] = useState(false);

  const { respondToToolCall } = generation;
  const respond = useCallback(
    async (input: { messageId: string; toolCallId: string; approved: boolean }) => {
      setIsResponding(true);
      let receivedCompletion = false;
      try {
        const controller = respondToToolCall({
          messageId: input.messageId,
          toolCallId: input.toolCallId,
          approved: input.approved,
        });
        const completed = await controller.done;
        receivedCompletion = true;
        if (completed.phase === 'failed') {
          throw new Error(completed.error ?? 'Unable to respond to the tool call.');
        }
      } catch (error) {
        if (!receivedCompletion) {
          await invalidateChatQueries(queryClient, chatId);
        }
        throw error;
      } finally {
        setIsResponding(false);
      }
    },
    [chatId, queryClient, respondToToolCall],
  );

  return { isResponding, respond };
}
