import type { GenerationClientInputEvent } from '@hominem/chat/client';
import type { ChatMessageDto } from '@hominem/rpc/types';
import type { QueryClient } from '@tanstack/react-query';

import type { ChatMessageItem } from '~/components/chat';
import { chatKeys } from '~/services/notes/query-keys';

import { handleChatGenerationEvent } from '../chat/chat-cache';
import type { ChatGenerationState } from '../chat/chat-generation';
import { clearLiveChat } from '../chat/live-turn-store';
import { subscribeToStreamingMessageText } from '../chat/streaming-text-store';
import {
  roundMs,
  startFrameSampler,
  startRecording,
  stopRecording,
  summarizeDurations,
} from './stream-perf';

// A fixed reply so every run (and every code change) is compared on identical
// input: several paragraphs, a list and inline formatting, ~1.4k characters.
const REPLY = [
  'Here is a quick plan for the week, built around the things you told me matter most.',
  'Monday is for **clearing the inbox** and settling the two open decisions. Tuesday and Wednesday are deep work: the draft, then the review pass. Keep Thursday light so nothing slips.',
  '1. Block two focused hours each morning before messages.\n2. Batch replies at noon and again at four.\n3. Leave Friday afternoon open for whatever spilled over.',
  'A few notes on why this shape works. Deep work needs unbroken stretches, and the research on attention is fairly consistent: switching costs add up quickly, even when each switch feels small. Putting the shallow work in fixed windows protects the rest of the day.',
  'If a day goes sideways, do not try to repay the lost hours later. Drop the lowest-value item, keep the first block intact, and move on. Small, repeatable habits beat heroic catch-up sessions every time.',
  'Want me to turn this into tasks with times attached, or keep it as a loose outline for now?',
].join('\n\n');

export type BenchScenario = 'steady' | 'burst' | 'long';

// long: the same reply five times over, to show how cost grows with length.
const LONG_REPLY = Array.from({ length: 5 }, () => REPLY).join('\n\n');

// steady: ~40 tokens/s the way a typical model streams.
// burst: the whole reply in well under 100ms, the way a fast model hands it over.
const SCENARIOS: Record<
  BenchScenario,
  { wordsPerEvent: number; intervalMs: number; reply: string }
> = {
  steady: { wordsPerEvent: 1, intervalMs: 25, reply: REPLY },
  burst: { wordsPerEvent: 12, intervalMs: 8, reply: REPLY },
  long: { wordsPerEvent: 2, intervalMs: 25, reply: LONG_REPLY },
};

export function isBenchScenario(value: string | undefined): value is BenchScenario {
  return value === 'steady' || value === 'burst' || value === 'long';
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function runStreamBench({
  queryClient,
  chatId,
  scenario,
}: {
  queryClient: QueryClient;
  chatId: string;
  scenario: BenchScenario;
}) {
  const { wordsPerEvent, intervalMs, reply } = SCENARIOS[scenario];
  const generationId = `bench-${Date.now()}`;
  const assistantId = `${generationId}-assistant`;
  const generation: ChatGenerationState = {
    id: generationId,
    chatId,
    stage: 'running',
    lastDurableSequence: 0,
  };
  const words = reply.match(/\s*\S+/g) ?? [];
  const messagesKey = chatKeys.messages(chatId);
  const hasCommitted = () =>
    queryClient.getQueryData<ChatMessageItem[]>(messagesKey)?.some((m) => m.id === assistantId);

  const handlerMs: number[] = [];
  const dispatch = (event: GenerationClientInputEvent) => {
    const start = performance.now();
    handleChatGenerationEvent({ queryClient, chatId, generation, event });
    handlerMs.push(performance.now() - start);
  };

  let firstWordAt: number | null = null;
  const unsubscribe = subscribeToStreamingMessageText(`streaming-${generationId}`, () => {
    firstWordAt ??= performance.now();
  });

  startRecording();
  const stopFrames = startFrameSampler();
  const startedAt = performance.now();

  for (let i = 0; i < words.length; i += wordsPerEvent) {
    dispatch({
      version: 1,
      type: 'text-delta',
      generationId,
      sequence: null,
      payload: { type: 'text-delta', text: words.slice(i, i + wordsPerEvent).join('') },
    });
    await sleep(intervalMs);
  }
  const streamEndedAt = performance.now();

  dispatch({
    version: 1,
    type: 'generation.committed',
    generationId,
    sequence: 2,
    payload: {
      type: 'generation.committed',
      message: {
        id: assistantId,
        chatId,
        userId: 'bench',
        role: 'assistant',
        content: reply,
        files: null,
        toolCalls: null,
        reasoning: null,
        parentMessageId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } satisfies ChatMessageDto,
    },
  });

  while (!hasCommitted() && performance.now() - startedAt < 120_000) {
    await sleep(16);
  }
  const committedAt = performance.now();
  // Let the post-commit markdown swap and any settling work land in the sample.
  await sleep(600);

  const frames = stopFrames();
  const recorded = stopRecording();
  unsubscribe();
  clearLiveChat(chatId);
  queryClient.setQueryData<ChatMessageItem[]>(messagesKey, (messages = []) =>
    messages.filter((m) => m.id !== assistantId && !m.id.startsWith('streaming-bench-')),
  );

  const result = {
    scenario,
    words: words.length,
    chars: reply.length,
    timeToFirstWordMs: roundMs((firstWordAt ?? committedAt) - startedAt),
    streamSendMs: roundMs(streamEndedAt - startedAt),
    // How long the reveal lagged behind the network after the last delta.
    catchUpAfterLastDeltaMs: roundMs(committedAt - streamEndedAt),
    totalToCommitMs: roundMs(committedAt - startedAt),
    handler: summarizeDurations(handlerMs),
    renders: recorded?.renders ?? {},
    reactCommits: recorded?.commits ?? 0,
    reactCommitMs: roundMs(recorded?.commitMs ?? 0),
    maxReactCommitMs: roundMs(recorded?.maxCommitMs ?? 0),
    frames,
  };
  // One line, greppable from the Metro log.
  console.log(`[stream-bench] ${JSON.stringify(result)}`);
  return result;
}
