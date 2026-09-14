import type { QueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import type { ChatMessageItem } from '~/components/chat';
import { playAudioReply } from '~/components/media/audio-playback.service';
import { chatKeys, inboxKeys } from '~/services/notes/query-keys';

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
}: {
  queryClient: QueryClient;
  chatId: string;
  message: Parameters<typeof toMessageOutput>[0];
}) {
  const committed = toMessageOutput(message);
  if (committed) {
    queryClient.setQueryData<ChatMessageItem[]>(
      chatKeys.messages(chatId),
      (currentMessages = []) => [
        ...currentMessages.filter((item) => item.id !== committed.id),
        committed,
      ],
    );
    if (committed.audio?.url) playAudioReply(committed.id, committed.audio.url);
  }
  triggerAssistantCompletionHaptic();
  void queryClient.invalidateQueries({ queryKey: inboxKeys.pages() });
  void invalidateChatQueries(queryClient, chatId);
  return committed;
}
