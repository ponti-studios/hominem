import type { GenerationClientInputEvent } from '@hominem/chat/client';
import type { QueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import type { ChatMessageItem } from '~/components/chat';
import { playAudioReply } from '~/components/media/audio-playback.service';
import { chatKeys, inboxKeys } from '~/services/notes/query-keys';
import { syncAfterChatTasks } from '~/services/tasks/sync-chat-tasks';

import type { ChatGenerationState } from './chat-generation';
import { toMessageOutput } from './use-chat-messages';

export function invalidateChatQueries(queryClient: QueryClient, chatId: string) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: chatKeys.activeChat(chatId) }),
    queryClient.invalidateQueries({ queryKey: chatKeys.messages(chatId) }),
    queryClient.invalidateQueries({ queryKey: chatKeys.list }),
  ]);
}

function triggerAssistantCompletionHaptic() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

// The single place that knows what happens when a generation commits --
// shared by useSendMessage (every reply after the first) and useStartChat
// (the very first reply in a brand-new chat, whose own subscription has to
// stay registered where it already is; see use-start-chat.ts for why it
// can't just wait for the destination screen to adopt the handoff and
// drive this from there).
export function applyGenerationCommitted({
  queryClient,
  chatId,
  message,
  targetMessageId,
}: {
  queryClient: QueryClient;
  chatId: string;
  message: Parameters<typeof toMessageOutput>[0];
  targetMessageId?: string;
}) {
  const committed = toMessageOutput(message);
  if (committed) {
    queryClient.setQueryData<ChatMessageItem[]>(
      chatKeys.messages(chatId),
      (currentMessages = []) => [
        ...currentMessages.filter(
          (item) => item.id !== committed.id && item.id !== targetMessageId,
        ),
        committed,
      ],
    );
    if (committed.audio?.url) {
      playAudioReply(committed.id, committed.audio.url);
    }
  }
  triggerAssistantCompletionHaptic();
  syncAfterChatTasks(committed?.toolCalls);
  void queryClient.invalidateQueries({ queryKey: inboxKeys.pages() });
  void invalidateChatQueries(queryClient, chatId);
  return committed;
}

export function handleChatGenerationEvent({
  queryClient,
  chatId,
  generation,
  event,
}: {
  queryClient: QueryClient;
  chatId: string;
  generation: ChatGenerationState;
  event: GenerationClientInputEvent;
}): void {
  if (!('payload' in event)) {
    return;
  }
  if (event.type === 'generation.accepted' && event.payload.userMessage) {
    const accepted = toMessageOutput(event.payload.userMessage);
    if (accepted) {
      queryClient.setQueryData<ChatMessageItem[]>(chatKeys.messages(chatId), (messages = []) =>
        messages.map((item) => (item.id === generation.userMessageId ? accepted : item)),
      );
    }
  }
  if (
    event.type === 'confirmation.required' ||
    event.type === 'confirmation.approved' ||
    event.type === 'confirmation.rejected' ||
    event.type === 'generation.cancelled' ||
    event.type === 'generation.failed'
  ) {
    void invalidateChatQueries(queryClient, chatId);
  }
  if (event.type === 'generation.committed') {
    applyGenerationCommitted({
      queryClient,
      chatId,
      message: event.payload.message,
      targetMessageId: generation.targetMessageId,
    });
  }
}
