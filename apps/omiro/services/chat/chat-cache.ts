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

const STREAMING_ID_PREFIX = 'streaming-';

function dropStreamingMessages(messages: ChatMessageItem[]) {
  return messages.filter((item) => !item.id.startsWith(STREAMING_ID_PREFIX));
}

// Text deltas build a provisional assistant message in the cache so the reply
// grows on screen while it is generated. The committed message replaces it.
function appendStreamingText({
  queryClient,
  chatId,
  generationId,
  text,
}: {
  queryClient: QueryClient;
  chatId: string;
  generationId: string;
  text: string;
}) {
  const id = `${STREAMING_ID_PREFIX}${generationId}`;
  queryClient.setQueryData<ChatMessageItem[]>(chatKeys.messages(chatId), (messages = []) => {
    const existing = messages.find((item) => item.id === id);
    if (!existing) {
      return [
        ...messages,
        {
          id,
          renderKey: id,
          role: 'assistant',
          message: text,
          createdAt: new Date().toISOString(),
          chatId,
          toolCalls: null,
          isStreaming: true,
        },
      ];
    }
    return messages.map((item) =>
      item.id === id ? { ...item, message: item.message + text } : item,
    );
  });
}

// Text arrives from the network in bursts (a fast model can send a whole reply
// in ~30ms), which would paint as one jump. Deltas queue here and trickle into
// the cache a few frames at a time, faster while the backlog is large.
const PACE_TICK_MS = 50;
const PACE_MIN_CHARS = 4;
const PACE_BACKLOG_DIVISOR = 12;

type PacedText = {
  queue: string;
  timer: ReturnType<typeof setInterval> | null;
  onDrain: (() => void)[];
  flush: () => void;
};

const pacedByGeneration = new Map<string, PacedText>();

function paceStreamingText({
  queryClient,
  chatId,
  generationId,
  text,
}: {
  queryClient: QueryClient;
  chatId: string;
  generationId: string;
  text: string;
}) {
  let paced = pacedByGeneration.get(generationId);
  if (!paced) {
    const created: PacedText = {
      queue: '',
      timer: null,
      onDrain: [],
      flush: () => {
        const count = Math.max(
          PACE_MIN_CHARS,
          Math.ceil(created.queue.length / PACE_BACKLOG_DIVISOR),
        );
        const slice = created.queue.slice(0, count);
        created.queue = created.queue.slice(count);
        if (slice) {
          appendStreamingText({ queryClient, chatId, generationId, text: slice });
        }
        if (created.queue) {
          return;
        }
        if (created.timer) {
          clearInterval(created.timer);
        }
        pacedByGeneration.delete(generationId);
        for (const done of created.onDrain) {
          done();
        }
      },
    };
    created.timer = setInterval(created.flush, PACE_TICK_MS);
    pacedByGeneration.set(generationId, created);
    paced = created;
  }
  paced.queue += text;
}

// Runs `then` once everything queued for this generation has been shown.
// Returns false when nothing is pending, so the caller can run it right away.
function afterPacedDrain(generationId: string, then: () => void) {
  const paced = pacedByGeneration.get(generationId);
  if (!paced) {
    return false;
  }
  paced.onDrain.push(then);
  return true;
}

function discardPacedText(generationId: string) {
  const paced = pacedByGeneration.get(generationId);
  if (!paced) {
    return;
  }
  if (paced.timer) {
    clearInterval(paced.timer);
  }
  pacedByGeneration.delete(generationId);
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
        ...dropStreamingMessages(currentMessages).filter(
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
  if (event.payload.type === 'text-delta') {
    paceStreamingText({
      queryClient,
      chatId,
      generationId: event.generationId,
      text: event.payload.text,
    });
    return;
  }
  if (event.type === 'generation.committed') {
    // A fast model hands over the whole reply in one burst; let the paced
    // reveal catch up before the committed message replaces it.
    const { generationId } = event;
    const apply = () =>
      applyGenerationCommitted({
        queryClient,
        chatId,
        message: event.payload.message,
        targetMessageId: generation.targetMessageId,
      });
    if (!afterPacedDrain(generationId, apply)) {
      apply();
    }
    return;
  }
  if (event.type === 'generation.cancelled' || event.type === 'generation.failed') {
    discardPacedText(event.generationId);
    queryClient.setQueryData<ChatMessageItem[]>(chatKeys.messages(chatId), (messages = []) =>
      dropStreamingMessages(messages),
    );
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
}
