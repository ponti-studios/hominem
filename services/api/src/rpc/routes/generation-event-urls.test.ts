import type { ChatMessageSnapshot, GenerationEvent } from '@hominem/chat';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@hominem/storage', () => ({
  fileStorageService: { signStoredUrl: vi.fn(async (url: string) => `${url}?sig=1`) },
}));
vi.mock('@hominem/telemetry', () => ({ logger: { warn: vi.fn() } }));

import { signGenerationEvents } from './generation-event-urls';

const message: ChatMessageSnapshot = {
  id: 'm1',
  chatId: 'c1',
  userId: 'u1',
  role: 'assistant',
  content: 'hi',
  files: [{ type: 'audio', url: 'https://files.test/a.mp3', mimeType: 'audio/mpeg' }],
  toolCalls: null,
  reasoning: null,
  parentMessageId: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

async function* source(events: GenerationEvent[]) {
  for (const event of events) yield event;
}

describe('signGenerationEvents', () => {
  it('signs attachment urls on committed events and leaves other events alone', async () => {
    const committed: GenerationEvent = {
      version: 1,
      generationId: 'g1',
      sequence: 2,
      type: 'generation.committed',
      payload: { type: 'generation.committed', message },
    };
    const delta: GenerationEvent = {
      version: 1,
      generationId: 'g1',
      sequence: null,
      type: 'text-delta',
      payload: { type: 'text-delta', text: 'x' },
    };

    const out: GenerationEvent[] = [];
    for await (const event of signGenerationEvents(source([delta, committed]))) out.push(event);

    expect(out[0]).toBe(delta);
    const signed = out[1];
    expect(signed?.type === 'generation.committed' && signed.payload.message.files?.[0]?.url).toBe(
      'https://files.test/a.mp3?sig=1',
    );
    // The stored event is untouched, so replay keeps the permanent url.
    expect(
      committed.payload.type === 'generation.committed' &&
        committed.payload.message.files?.[0]?.url,
    ).toBe('https://files.test/a.mp3');
  });
});
