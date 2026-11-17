import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import { DRAIN_MAX_BYTES, drainRejectedBody } from './drain-rejected-body';

const app = new Hono()
  .use('*', drainRejectedBody())
  .post('/reject', (c) => c.json({ error: 'nope' }, 401))
  .post('/accept', (c) => c.text('ok'));

function post(path: string, body: string) {
  const req = new Request(`http://api.test${path}`, { method: 'POST', body });
  return { req, res: app.request(req) };
}

describe('drainRejectedBody', () => {
  it('reads the unread body of a rejected request before it returns', async () => {
    const { req, res } = post('/reject', '{"amount":');
    expect((await res).status).toBe(401);
    expect(req.bodyUsed).toBe(true);
  });

  it('leaves the body alone on a successful response, so the handler still owns it', async () => {
    const { req, res } = post('/accept', 'payload');
    expect((await res).status).toBe(200);
    expect(req.bodyUsed).toBe(false);
  });

  it('stops at the cap for a huge body and still returns the rejection', async () => {
    const huge = 'a'.repeat(DRAIN_MAX_BYTES * 2);
    const { res } = post('/reject', huge);
    expect((await res).status).toBe(401);
  });

  it('does not throw when there is no body', async () => {
    const res = await app.request('/reject', { method: 'POST' });
    expect(res.status).toBe(401);
  });
});
