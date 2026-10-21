import { describe, expect, it } from 'vitest';

import { createCustomFetch } from './api-client';

describe('createCustomFetch timeouts', () => {
  it('does not abort slow calls when no timeout is configured', async () => {
    let signal: AbortSignal | undefined;
    const fetchImpl = async (_input: RequestInfo | URL, init?: RequestInit) => {
      signal = init?.signal ?? undefined;
      await new Promise((resolve) => setTimeout(resolve, 30));
      return new Response('ok');
    };

    const response = await createCustomFetch({ baseUrl: 'http://x' }, fetchImpl)('http://x/slow');

    expect(await response.text()).toBe('ok');
    expect(signal?.aborted).toBe(false);
  });

  it('aborts when a timeout is configured', async () => {
    const fetchImpl = (_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
      });

    await expect(
      createCustomFetch({ baseUrl: 'http://x', timeoutMs: 10 }, fetchImpl)('http://x/hang'),
    ).rejects.toThrow('timed out after 10ms');
  });
});
