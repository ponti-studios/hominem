import { describe, expect, it, vi } from 'vitest';

import { createRedisChatEffectStore } from './redis-adapters';

describe('Redis chat adapters', () => {
  it('round-trips an idempotent tool result with expiry', async () => {
    let stored: string | null = null;
    const redis = {
      get: vi.fn(async () => stored),
      set: vi.fn(async (_key: string, value: string) => {
        stored = value;
      }),
    };
    const effects = createRedisChatEffectStore(redis);
    const input = {
      generationId: 'generation-1',
      idempotencyKey: 'effect-1',
      toolName: 'places.list',
    };
    const result = { callId: 'call-1', toolName: input.toolName, content: '[]', error: false };

    await expect(effects.get(input)).resolves.toBeNull();
    await effects.save({ ...input, result });
    await expect(effects.get(input)).resolves.toEqual(result);
    expect(redis.set).toHaveBeenCalledWith(
      'chat:effect:generation-1:effect-1:places.list',
      JSON.stringify(result),
      'EX',
      60 * 60 * 24 * 30,
    );
  });
});
