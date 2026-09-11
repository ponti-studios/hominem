import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  handler: vi.fn(),
}));

vi.mock('../auth/better-auth', () => ({
  betterAuthServer: {
    api: { getSession: mocks.getSession },
    handler: mocks.handler,
  },
  getTrustedOrigins: () => [
    'http://localhost:4040',
    'https://career.ponti.io',
    'https://finance.ponti.io',
    'https://labs.ponti.io',
  ],
}));

vi.mock('../env', () => ({
  env: {
    API_URL: 'http://localhost:4040',
  },
}));

import { loginRoutes } from './login';

const oauthQuery = new URLSearchParams({
  client_id: 'codex',
  redirect_uri: 'http://localhost:61531/callback',
  response_type: 'code',
  state: 'state-123',
}).toString();

function createApp() {
  return new Hono().route('/', loginRoutes);
}

describe('API login route', () => {
  beforeEach(() => {
    mocks.getSession.mockReset();
    mocks.handler.mockReset();
    mocks.getSession.mockResolvedValue(null);
  });

  it('renders the API-hosted OTP form for an OAuth authorization request', async () => {
    const response = await createApp().request(`http://localhost/login?${oauthQuery}`);

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toContain('a one-time code — no password to remember');
    expect(mocks.getSession).toHaveBeenCalledOnce();
  });

  it('rejects a login request without a valid OAuth authorization query', async () => {
    const response = await createApp().request('http://localhost/login');

    expect(response.status).toBe(400);
    await expect(response.text()).resolves.toContain(
      'Open the sign-in link from the app or client you came from.',
    );
  });

  it('renders the OTP form for an allow-listed app redirect request', async () => {
    const next = encodeURIComponent('https://career.ponti.io/work');
    const response = await createApp().request(`http://localhost/login?next=${next}`);

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toContain('a one-time code — no password to remember');
  });

  it('rejects an app redirect request to a non-allow-listed origin', async () => {
    const next = encodeURIComponent('https://evil.example/steal');
    const response = await createApp().request(`http://localhost/login?next=${next}`);

    expect(response.status).toBe(400);
  });

  it('serves the Hominem logo used by the auth card', async () => {
    const response = await createApp().request('http://localhost/logo.hominem.500x500.webp');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/webp');
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(0);
  });

  it('serves the login browser bundle', async () => {
    const response = await createApp().request('http://localhost/login.js');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/javascript; charset=utf-8');
    await expect(response.text()).resolves.toContain('data-otp-digit');
  });

  it('serves static assets with cache validators and no HEAD body', async () => {
    const getResponse = await createApp().request('http://localhost/logo.hominem.500x500.webp');
    const etag = getResponse.headers.get('etag');
    const notModifiedResponse = await createApp().request(
      'http://localhost/logo.hominem.500x500.webp',
      { headers: { 'if-none-match': etag! } },
    );
    const headResponse = await createApp().request('http://localhost/logo.hominem.500x500.webp', {
      method: 'HEAD',
    });

    expect(etag).toBeTruthy();
    expect(notModifiedResponse.status).toBe(304);
    expect(headResponse.status).toBe(getResponse.status);
    expect(headResponse.body).toBeNull();
  });

  it('sends the OTP through Better Auth and advances to verification', async () => {
    mocks.handler.mockResolvedValue(new Response(null, { status: 200 }));
    const response = await createApp().request('http://localhost/login/send', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ email: 'mcp@example.com', resume: oauthQuery }).toString(),
    });

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toContain('step=otp');
    const request = mocks.handler.mock.calls[0]?.[0] as Request;
    expect(request.url).toContain('/api/auth/email-otp/send-verification-otp');
    await expect(request.json()).resolves.toEqual({ email: 'mcp@example.com', type: 'sign-in' });
  });

  it('keeps Better Auth session cookies while resuming OAuth authorization', async () => {
    mocks.handler.mockResolvedValue(
      new Response(null, {
        headers: {
          location: 'http://127.0.0.1:60693/callback/complete',
          'set-cookie': 'better-auth.session_token=session-token; Path=/; HttpOnly',
        },
        status: 302,
      }),
    );
    const response = await createApp().request('http://localhost/login/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        email: 'mcp@example.com',
        resume: oauthQuery,
        otp: '123456',
      }).toString(),
    });

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toContain('/api/auth/oauth2/authorize?');
    expect(response.headers.get('set-cookie')).toContain('better-auth.session_token=session-token');
    const request = mocks.handler.mock.calls[0]?.[0] as Request;
    expect(request.url).toContain('/api/auth/sign-in/email-otp');
  });

  it('renders a signed-out state when no browser session exists', async () => {
    const response = await createApp().request('http://localhost/logout');

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toContain('Signed out');
  });

  it('clears the Better Auth session and renders the logout confirmation', async () => {
    mocks.handler.mockResolvedValue(
      new Response(null, {
        headers: {
          'set-cookie': 'better-auth.session_token=; Max-Age=0; Path=/; HttpOnly',
        },
        status: 200,
      }),
    );

    const response = await createApp().request('http://localhost/logout', { method: 'POST' });

    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
    await expect(response.text()).resolves.toContain('Signed out');
    const request = mocks.handler.mock.calls[0]?.[0] as Request;
    expect(request.url).toContain('/api/auth/sign-out');
  });

  it('redirects to the login page after sign-out when a next is given', async () => {
    mocks.handler.mockResolvedValue(
      new Response(null, {
        headers: {
          'set-cookie': 'better-auth.session_token=; Max-Age=0; Path=/; HttpOnly',
        },
        status: 200,
      }),
    );
    const next = 'http://localhost:4040/login?next=http%3A%2F%2Flocalhost%3A4040%2Fauth%2Fsettings';

    const response = await createApp().request('http://localhost/logout', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ next }).toString(),
    });

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(next);
    // the cleared session cookie still travels with the redirect
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
    const request = mocks.handler.mock.calls[0]?.[0] as Request;
    expect(request.url).toContain('/api/auth/sign-out');
  });

  it('redirects signed-out visitors to hosted login with a settings resume', async () => {
    const response = await createApp().request('http://localhost/auth/settings');

    expect(response.status).toBe(303);
    const location = response.headers.get('location');
    expect(location).toContain('/login?');
    // Redirect targets use the incoming request's origin so the browser can
    // actually follow them through the proxy (in dev that is 443, not the
    // env's internal :4200).
    expect(decodeURIComponent(location ?? '')).toContain('http://localhost/auth/settings');
    expect(decodeURIComponent(location ?? '')).toContain('step=email');
  });

  it('serves the login page for a request-origin resume (portless-style next)', async () => {
    const next = encodeURIComponent('http://localhost/auth/settings');
    const response = await createApp().request(`http://localhost/login?next=${next}`);

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toContain('a one-time code — no password to remember');
  });

  it('renders the account settings page for a signed-in session', async () => {
    mocks.getSession.mockResolvedValue({
      user: { id: 'u1', name: 'Ada Lovelace', email: 'ada@example.com' },
    });

    const response = await createApp().request('http://localhost/auth/settings');

    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('Manage your Hominem account.');
    expect(html).toContain('value="Ada Lovelace"');
    expect(html).toContain('ada@example.com');
    expect(html).toContain('data-settings-signout');
    expect(html).toContain('/settings.js');
  });

  it('serves the settings browser bundle', async () => {
    const response = await createApp().request('http://localhost/settings.js');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/javascript; charset=utf-8');
    await expect(response.text()).resolves.toContain('data-settings-usage');
  });

  it('redirects signed-out visitors to hosted login with an AI-settings resume', async () => {
    const response = await createApp().request('http://localhost/auth/settings/ai');

    expect(response.status).toBe(303);
    const location = response.headers.get('location');
    expect(location).toContain('/login?');
    expect(decodeURIComponent(location ?? '')).toContain('http://localhost/auth/settings/ai');
  });

  it('renders the AI-usage page for a signed-in session and serves its bundle', async () => {
    mocks.getSession.mockResolvedValue({
      user: { id: 'u1', name: 'Ada Lovelace', email: 'ada@example.com' },
    });

    const response = await createApp().request('http://localhost/auth/settings/ai');

    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('Where your Hominem AI budget went');
    expect(html).toContain('data-uai-period');
    expect(html).toContain('Back to account');
    expect(html).toContain('/settings-ai.js');

    const bundle = await createApp().request('http://localhost/settings-ai.js');
    expect(bundle.status).toBe(200);
    await expect(bundle.text()).resolves.toContain('data-uai-seg');
  });

  it('updates the profile name through Better Auth', async () => {
    mocks.handler.mockResolvedValue(
      new Response(JSON.stringify({ status: true }), {
        headers: {
          'content-type': 'application/json',
          'set-cookie': 'better-auth.session_token=refreshed; Path=/; HttpOnly',
        },
        status: 200,
      }),
    );

    const response = await createApp().request('http://localhost/auth/settings/profile', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ name: 'Ada Lovelace' }).toString(),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: true });
    expect(response.headers.get('set-cookie')).toContain('refreshed');
    const request = mocks.handler.mock.calls[0]?.[0] as Request;
    expect(request.url).toContain('/api/auth/update-user');
    await expect(request.json()).resolves.toEqual({ name: 'Ada Lovelace' });
  });

  it('rejects an empty profile name', async () => {
    const response = await createApp().request('http://localhost/auth/settings/profile', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ name: '   ' }).toString(),
    });

    expect(response.status).toBe(400);
    expect(mocks.handler).not.toHaveBeenCalled();
  });
});
