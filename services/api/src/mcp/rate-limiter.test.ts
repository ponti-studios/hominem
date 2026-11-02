import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  eval: vi.fn(),
}));

vi.mock('@hominem/services/redis', () => ({
  redis: mocks,
}));

import { checkRateLimit, MCP_RATE_LIMIT } from './rate-limiter';

describe('rate limiter', () => {
  beforeEach(() => {
    mocks.eval.mockReset();
  });

  it('allows requests through the configured limit', async () => {
    for (let count = 1; count <= MCP_RATE_LIMIT.limit; count += 1) {
      mocks.eval.mockResolvedValueOnce(count);
      await expect(checkRateLimit('user-1')).resolves.toBe('allowed');
    }
    expect(mocks.eval).toHaveBeenCalledTimes(MCP_RATE_LIMIT.limit);
  });

  it('blocks the request after the configured limit', async () => {
    mocks.eval.mockResolvedValue(MCP_RATE_LIMIT.limit + 1);

    await expect(checkRateLimit('user-1')).resolves.toBe('limited');
  });

  it('uses a separate hashed Redis key per user', async () => {
    mocks.eval.mockResolvedValue(1);

    await checkRateLimit('user-1');
    await checkRateLimit('user-2');

    expect(mocks.eval.mock.calls[0]?.[2]).not.toBe(mocks.eval.mock.calls[1]?.[2]);
    expect(mocks.eval.mock.calls[0]?.[2]).toMatch(/^ratelimit:mcp:[a-f0-9]{32}$/);
  });

  it('increments and sets the one-second TTL atomically', async () => {
    mocks.eval.mockResolvedValue(1);

    await checkRateLimit('user-1');

    expect(mocks.eval).toHaveBeenCalledWith(
      expect.stringContaining('redis.call'),
      1,
      expect.stringMatching(/^ratelimit:mcp:[a-f0-9]{32}$/),
      '1',
    );
  });

  it('reports unavailable when Redis is unavailable', async () => {
    mocks.eval.mockRejectedValue(new Error('redis unavailable'));

    await expect(checkRateLimit('user-1')).resolves.toBe('unavailable');
  });
});
