import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import { requestBodyLimit } from './body-limit';

const app = new Hono()
  .use('*', requestBodyLimit())
  .post('/anything', async (c) => c.text(String((await c.req.text()).length)))
  .post('/api/files', async (c) => c.text(String((await c.req.text()).length)));

const post = (path: string, size: number) =>
  app.request(path, { method: 'POST', body: 'x'.repeat(size) });

describe('request body limit', () => {
  it('lets small bodies through', async () => {
    expect((await post('/anything', 1000)).status).toBe(200);
  });

  it('rejects bodies over 1 MB with 413', async () => {
    expect((await post('/anything', 1024 * 1024 + 1)).status).toBe(413);
  });

  it('allows bigger bodies on the file upload route', async () => {
    expect((await post('/api/files', 2 * 1024 * 1024)).status).toBe(200);
  });
});
