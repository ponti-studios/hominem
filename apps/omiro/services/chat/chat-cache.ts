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
// in ~30ms). Reveal complete words, grouping a larger backlog into short
// phrases so fast generations catch up without turning into a character
// typewriter. Small cadence variation keeps the rhythm from feeling mechanical.
const PACE_FIRST_TICK_MS = 42;
const PACE_MEDIUM_BACKLOG_CHARS = 48;
const PACE_LARGE_BACKLOG_CHARS = 120;
const PACE_VARIATION_MS = [0, 9, 17, 5, 13] as const;

type PacedText = {
  queue: string;
  timer: ReturnType<typeof setTimeout> | null;
  onDrain: (() => void)[];
  finalized: boolean;
  tick: number;
  flush: () => void;
};

const pacedByGeneration = new Map<string, PacedText>();

function wordsPerChunk(queue: string) {
  if (queue.length >= PACE_LARGE_BACKLOG_CHARS) {
    return 3;
  }
  if (queue.length >= PACE_MEDIUM_BACKLOG_CHARS) {
    return 2;
  }
  return 1;
}

function isPunctuationBoundary(word: string) {
  return /[.!?,;:]$/.test(word);
}

function takeWordChunk(queue: string, maxWords: number, finalized: boolean): string | null {
  let cursor = 0;
  let words = 0;

  while (cursor < queue.length) {
    while (cursor < queue.length && /\s/.test(queue[cursor]!)) {
      cursor += 1;
    }
    if (cursor >= queue.length) {
      return finalized ? queue : null;
    }

    const wordStart = cursor;
    while (cursor < queue.length && !/\s/.test(queue[cursor]!)) {
      cursor += 1;
    }
    const word = queue.slice(wordStart, cursor);
    const hasWordBoundary = cursor < queue.length;
    words += 1;

    if (words >= maxWords || isPunctuationBoundary(word)) {
      if (!hasWordBoundary && !finalized && !isPunctuationBoundary(word)) {
        return null;
      }
      while (cursor < queue.length && /\s/.test(queue[cursor]!)) {
        cursor += 1;
      }
      return queue.slice(0, cursor);
    }
  }

  return finalized && queue ? queue : null;
}

function nextPaceDelay(text: string, tick: number) {
  const words = text.trim().split(/\s+/).length;
  const base = words >= 3 ? 56 : words === 2 ? 48 : 40;
  const variation = PACE_VARIATION_MS[tick % PACE_VARIATION_MS.length]!;
  const end = text.trimEnd();
  const punctuationPause = /[.!?]["'’”)}\]]*$/.test(end)
    ? 140
    : /[,;:]["'’”)}\]]*$/.test(end)
      ? 55
      : 0;
  return base + variation + punctuationPause;
}

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
  if (!text) {
    return;
  }
  let paced = pacedByGeneration.get(generationId);
  if (!paced) {
    const created: PacedText = {
      queue: '',
      timer: null,
      onDrain: [],
      finalized: false,
      tick: 0,
      flush: () => {
        created.timer = null;
        const chunk = takeWordChunk(created.queue, wordsPerChunk(created.queue), created.finalized);

        if (!chunk && created.queue && !created.finalized) {
          created.timer = setTimeout(created.flush, PACE_FIRST_TICK_MS);
          return;
        }

        if (chunk) {
          created.queue = created.queue.slice(chunk.length);
          appendStreamingText({ queryClient, chatId, generationId, text: chunk });
        }

        if (created.queue) {
          created.tick += 1;
          created.timer = setTimeout(created.flush, nextPaceDelay(chunk ?? '', created.tick));
          return;
        }

        pacedByGeneration.delete(generationId);
        for (const done of created.onDrain) {
          done();
        }
      },
    };
    created.timer = setTimeout(created.flush, PACE_FIRST_TICK_MS);
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
  paced.finalized = true;
  paced.onDrain.push(then);
  if (paced.timer) {
    clearTimeout(paced.timer);
  }
  paced.timer = setTimeout(paced.flush, PACE_FIRST_TICK_MS);
  return true;
}

function discardPacedText(generationId: string) {
  const paced = pacedByGeneration.get(generationId);
  if (!paced) {
    return;
  }
  if (paced.timer) {
    clearTimeout(paced.timer);
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
