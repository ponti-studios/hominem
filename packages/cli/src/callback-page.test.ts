import { createServer } from 'node:http';

import { describe, expect, it } from 'vitest';

import { waitForCode } from './auth';
import { callbackPage } from './callback-page';

async function redirect(query: string) {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const result = waitForCode(server, 'state-1', 'Hominem').catch((error: unknown) => error);
  const response = await fetch(`http://127.0.0.1:${port}/callback?state=state-1&${query}`);
  const body = await response.text();
  server.close();
  return { response, body, result: await result };
}

describe('sign-in callback page', () => {
  it('serves the success page as UTF-8 HTML', async () => {
    const { response, body, result } = await redirect('code=abc');
    expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(body).toContain('You’re signed in');
    expect(result).toBe('abc');
  });

  it('serves the failure page without echoing the redirect', async () => {
    const { body, result } = await redirect('error=%3Cscript%3Eboom');
    expect(body).toContain('Sign-in didn’t go through');
    expect(body).not.toContain('boom');
    expect(result).toBeInstanceOf(Error);
  });

  it('names Google on the Google pages', () => {
    expect(callbackPage('ok', 'Google')).toContain('Google is connected');
    expect(callbackPage('fail', 'Google')).toContain('Google didn’t connect');
  });
});
