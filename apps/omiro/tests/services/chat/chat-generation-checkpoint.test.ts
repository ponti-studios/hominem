import type { GenerationClientState } from '@hominem/chat/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearGenerationCheckpoint,
  createGenerationCheckpointStore,
} from '~/services/chat/chat-generation-checkpoint';
import { storage } from '~/services/storage/mmkv';

vi.mock('~/services/storage/mmkv', async () => (await import('../../mocks/mmkv')).mockMmkvModule());

const state = (lastDurableSequence: number): GenerationClientState =>
  ({
    generationId: 'gen-1',
    phase: 'running',
    text: '',
    reasoning: '',
    toolSteps: [],
    lastDurableSequence,
    error: null,
  }) satisfies GenerationClientState;

describe('generation checkpoint store', () => {
  beforeEach(() => {
    clearGenerationCheckpoint('chat-1');
    vi.restoreAllMocks();
  });

  it('skips the write when the checkpoint has not changed', () => {
    const store = createGenerationCheckpointStore('chat-1');
    const write = vi.spyOn(storage, 'set');

    store.set(state(1));
    store.set(state(1));
    store.set(state(1));
    expect(write).toHaveBeenCalledTimes(1);

    store.set(state(2));
    expect(write).toHaveBeenCalledTimes(2);
  });

  it('writes again after the checkpoint was cleared', () => {
    const store = createGenerationCheckpointStore('chat-1');
    const write = vi.spyOn(storage, 'set');

    store.set(state(1));
    clearGenerationCheckpoint('chat-1');
    store.set(state(1));
    expect(write).toHaveBeenCalledTimes(2);
  });
});
