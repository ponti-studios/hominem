import { createServer } from 'node:http';

import { describe, expect, it } from 'vitest';

import { customFetch, internalDispatcher } from './server-api-client';

describe('server internal client', () => {
  it('reuses one keep-alive connection across sequential calls', async () => {
    let connections = 0;
    const server = createServer((_request, response) => {
      response.writeHead(200, { 'content-type': 'text/plain' });
      response.end('ok');
    });
    server.on('connection', () => {
      connections += 1;
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Expected a TCP server address');

    try {
      const wrappedFetch = customFetch({ baseUrl: `http://127.0.0.1:${address.port}` });
      const first = await wrappedFetch(`http://127.0.0.1:${address.port}/first`);
      await first.text();
      // Give the socket a moment to return to the pool before the next call,
      // the same way two real SSR requests are separated in time.
      await new Promise((resolve) => setTimeout(resolve, 50));
      const second = await wrappedFetch(`http://127.0.0.1:${address.port}/second`);
      await second.text();

      expect(connections).toBe(1);
    } finally {
      await internalDispatcher.close();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
});
