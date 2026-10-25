import type { GenerationHistoryEvent as GenerationDomainEvent } from '@hominem/chat';
import { ChatClient } from '@hominem/chat/client';
import { xhrChatTransport } from '@hominem/chat/transport/xhr';
import NetInfo from '@react-native-community/netinfo';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { useCallback, useRef, useState } from 'react';

import type { ChatMessageItem } from '~/components/chat';
import { API_BASE_URL } from '~/constants';
import { getChatResponseLength } from '~/hooks/use-chat-response-length';
import { useAuth } from '~/services/auth/auth-provider';
import { OFFLINE_UNAVAILABLE_ERROR } from '~/services/chat/chat-errors';
import {
  clearGenerationHandoff,
  registerGenerationHandoff,
} from '~/services/chat/generation-handoff';
import { toMessageOutput } from '~/services/chat/use-chat-messages';
import { invalidateInboxQueries } from '~/services/inbox/inbox-refresh';
import { chatKeys } from '~/services/notes/query-keys';

import { applyGenerationCommitted, invalidateChatQueries } from './chat-cache';

interface StartChatOptions {
  onAccepted?: (event: Extract<GenerationDomainEvent, { type: 'generation.accepted' }>) => void;
}

type StartChatInput = {
  title: string;
  message: string;
  fileIds?: string[];
};

export function useStartChat() {
  const { getAuthHeaders } = useAuth();
  const queryClient = useQueryClient();
  const [chatClient] = useState(
    () =>
      new ChatClient({
        baseUrl: API_BASE_URL,
        headers: getAuthHeaders,
        transport: xhrChatTransport(),
      }),
  );
  const startedChatIdRef = useRef<string | null>(null);

  const reconcileStartedChat = useCallback(
    (chatId: string) =>
      Promise.all([
        invalidateInboxQueries(queryClient),
        invalidateChatQueries(queryClient, chatId),
      ]),
    [queryClient],
  );

  const { mutateAsync: startChat, isPending: isStartingChat } = useMutation<
    string,
    Error,
    StartChatInput & StartChatOptions
  >({
    mutationFn: async ({ onAccepted, ...input }) => {
      const net = await NetInfo.fetch();
      if (net.isConnected === false) {
        throw new Error(OFFLINE_UNAVAILABLE_ERROR);
      }

      startedChatIdRef.current = null;
      const generation = chatClient.start({
        ...input,
        generationId: randomUUID(),
        responseLength: getChatResponseLength(),
      });
      let unsubscribe: () => void = () => {};
      unsubscribe = generation.subscribe((_state, event) => {
        if (!('payload' in event)) {
          return;
        }
        if (event.type === 'generation.accepted') {
          startedChatIdRef.current = event.payload.chatId;
          const userMessage = event.payload.userMessage
            ? toMessageOutput(event.payload.userMessage)
            : null;
          queryClient.setQueryData(chatKeys.activeChat(event.payload.chatId), event.payload.chat);
          queryClient.setQueryData<ChatMessageItem[]>(
            chatKeys.messages(event.payload.chatId),
            userMessage ? [userMessage] : [],
          );
          void reconcileStartedChat(event.payload.chatId);
          // Hand the live controller to whichever screen mounts next at this
          // chatId: router.replace to the chat route unmounts this screen
          // (and this ChatClient with it), so the destination screen's own
          // useChatGeneration needs a way to pick up the generation already
          // in flight. Adopting the controller directly -- rather than
          // seeding a checkpoint and letting that screen resume from
          // storage -- means one SSE connection total, and userMessageId
          // travels as a plain object property instead of needing to
          // survive a round trip through MMKV.
          if (onAccepted) {
            registerGenerationHandoff(event.payload.chatId, {
              controller: generation,
              releasePreviousSubscription: unsubscribe,
              ...(event.payload.userMessage ? { userMessageId: event.payload.userMessage.id } : {}),
            });
          }
          onAccepted?.(event);
        }
        if (event.type === 'generation.committed' && startedChatIdRef.current) {
          applyGenerationCommitted({
            queryClient,
            chatId: startedChatIdRef.current,
            generationId: event.generationId,
            message: event.payload.message,
          });
        }
      });

      try {
        const completed = await generation.done;
        if (completed.phase === 'failed') {
          throw new Error(completed.error ?? 'Generation failed.');
        }
      } catch (error) {
        if (startedChatIdRef.current) {
          void reconcileStartedChat(startedChatIdRef.current);
        }
        throw error;
      } finally {
        unsubscribe();
        if (startedChatIdRef.current) {
          clearGenerationHandoff(startedChatIdRef.current, generation);
        }
      }
      if (!startedChatIdRef.current) {
        throw new Error('Chat was not created');
      }
      await reconcileStartedChat(startedChatIdRef.current);
      return startedChatIdRef.current;
    },
  });

  return {
    isStartingChat,
    startChat,
  };
}
