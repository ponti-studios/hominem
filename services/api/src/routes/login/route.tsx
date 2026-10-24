import { join } from 'node:path';

import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { etag } from 'hono/etag';

import { creditHistory, deleteAccount, exportAccount } from '../../application/account';
import { deleteAccountDeps } from '../../application/account.runtime';
import { inCreditMode, parseTesters, signLinkToken } from '../../application/credit';
import {
  createMcpToken,
  listMcpTokens,
  revokeMcpToken,
} from '../../application/mcp-tokens.service';
import { listOAuthClients, revokeOAuthClient } from '../../application/oauth-clients.service';
import { betterAuthServer } from '../../auth/better-auth';
import { env } from '../../env';
import { getClientIp } from '../../middleware/client-ip';
import { checkOtpSendLimits } from '../../middleware/rate-limit';
import {
  createMcpTokenInputSchema,
  createMcpTokenOutputSchema,
  listMcpTokensOutputSchema,
  revokeMcpTokenInputSchema,
  revokeMcpTokenOutputSchema,
} from '../../schemas/mcp-tokens.schema';
import {
  listOAuthClientsOutputSchema,
  revokeOAuthClientInputSchema,
  revokeOAuthClientOutputSchema,
} from '../../schemas/oauth-clients.schema';
import type { AuthDependencies } from '../auth/shared';
import { renderAuthShell } from './app-shell';
import {
  emailSchema,
  getFormValue,
  loginUrl,
  otpSchema,
  resolveConsentQuery,
  resolvePostAuthResume,
  resolveResume,
} from './helpers';

const publicRoot = join(
  process.cwd(),
  process.env.NODE_ENV === 'production' ? 'dist/public' : 'public',
);
const logoPath = join(publicRoot, 'logo.hominem.500x500.webp');

function serveAsset(path: string, contentType: string) {
  return serveStatic({
    path,
    onFound: (_path, c) => {
      c.header('cache-control', 'public, max-age=86400');
      c.header('content-type', contentType);
    },
  });
}

async function callBetterAuth(input: {
  body: Record<string, string | boolean>;
  path: string;
  request: Request;
  auth: AuthDependencies['auth'];
  env: AuthDependencies['env'];
}) {
  const headers = new Headers(input.request.headers);
  headers.set('content-type', 'application/json');
  // Stamp the origin unconditionally: these calls run server-side on behalf
  // of the API, so the incoming request's Origin (e.g. the browser's
  // portless-443 host) must never leak into Better Auth's CSRF check — only
  // the configured API origin is a trusted origin (surface-host examples:
  // the proxy serves api.lvh.me on 443 while API_URL is api.lvh.me:4200).
  headers.set('origin', input.env.API_URL);
  return input.auth.handler(
    new Request(new URL(`/api/auth${input.path}`, input.env.API_URL), {
      method: 'POST',
      headers,
      body: JSON.stringify(input.body),
    }),
  );
}

function copySetCookieHeaders(headers: Headers) {
  const copied = new Headers(headers);
  const setCookies = headers.getSetCookie();
  if (setCookies.length > 0) {
    copied.delete('set-cookie');
    for (const setCookie of setCookies) copied.append('set-cookie', setCookie);
  }
  return copied;
}

export function createLoginRoutes(dependencies: AuthDependencies) {
  const { env: inputEnv, auth, rateLimitCounter } = dependencies;
  const resolveResumeWithEnv = (query: string, origin?: string) =>
    resolveResume(query, inputEnv, origin);
  const resolvePostAuthResumeWithEnv = (query: string, origin?: string) =>
    resolvePostAuthResume(query, inputEnv, origin);
  // The top-up page link for a person the credit flag lets in; null for everyone else.
  const creditUrlFor = async (user: { id: string; email: string | null }, origin: string) => {
    const mode = inputEnv.CREDIT_MODE ?? 'off';
    if (mode === 'off' || !user.email) return null;
    const config = {
      mode,
      testers: parseTesters(inputEnv.CREDIT_TESTERS ?? ''),
      usdPerPound: 0,
      grantPence: 0,
      grantsPerDay: 0,
    };
    if (!inCreditMode(config, user.email)) {
      if (mode !== 'test') return null;
      // Loaded here, not at the top: importing the runtime builds the PostHog client, which a route test cannot do.
      const { creditFlagFor } = await import('../../application/credit.runtime');
      if (!(await creditFlagFor({ id: user.id, email: user.email }))) return null;
    }
    const token = signLinkToken(inputEnv.BETTER_AUTH_SECRET, user.id, new Date());
    return new URL(`/credit?t=${token}`, origin).toString();
  };
  // What a person in credit mode has left, in pence; null when it cannot be read just now.
  const creditBalanceFor = async (userId: string): Promise<number | null> => {
    try {
      const { creditDeps } = await import('../../application/credit.runtime');
      const { creditFor } = await import('../../application/credit');
      const deps = creditDeps();
      return deps ? (await creditFor(deps, userId)).balancePence : null;
    } catch {
      return null;
    }
  };
  // "omiro.ponti.io" -> "Omiro". Hidden when the target is the auth host itself.
  const appNameFor = (url: string, origin: string) => {
    const host = new URL(url).hostname;
    if (host === new URL(origin).hostname) return undefined;
    const label = host.split('.')[0] ?? '';
    return label ? label.charAt(0).toUpperCase() + label.slice(1) : undefined;
  };
  const loginUrlWithEnv = (value: Parameters<typeof loginUrl>[0], origin?: string) =>
    loginUrl({ ...value, origin }, inputEnv);
  // Redirects are followed by the browser, so they must point at the host
  // the browser reached, not the env's internal port (identical in
  // production). The proxy terminates TLS and forwards plain HTTP without
  // x-forwarded-proto, so take the scheme from the canonical API_URL and
  // the host from the actual request.
  const requestOrigin = (c: { req: { url: string } }) => {
    const url = new URL(inputEnv.API_URL);
    const requestUrl = new URL(c.req.url);
    url.hostname = requestUrl.hostname;
    url.port = requestUrl.port;
    return url.origin;
  };

  const loginRoutes = new Hono()
    .use(
      '/assets/*',
      etag(),
      serveStatic({
        root: publicRoot,
        onFound: (_path, c) => c.header('cache-control', 'public, max-age=31536000, immutable'),
      }),
    )
    .use('/logo.hominem.500x500.webp', etag(), serveAsset(logoPath, 'image/webp'))
    .get('/login', async (c) => {
      const url = new URL(c.req.url);
      const origin = requestOrigin(c);
      const resumeQuery = url.searchParams.toString();
      const resume = resolveResumeWithEnv(resumeQuery, origin);
      if (!resume)
        return c.html(
          renderAuthShell({
            entry: 'error',
            init: {
              description: 'Open the sign-in link from the app or client you came from.',
              error: 'invalid_request',
            },
            title: 'Authorization stopped | Hominem',
          }),
          400,
        );
      const session = await auth.api.getSession({ headers: c.req.raw.headers });
      if (session) return c.redirect(resume.url);
      const email = url.searchParams.get('email') ?? '';
      const step =
        url.searchParams.get('step') === 'otp' && emailSchema.safeParse(email).success
          ? 'otp'
          : 'email';
      return c.html(
        renderAuthShell({
          entry: 'login',
          init: {
            mode: resume.mode,
            resumeQuery,
            email,
            step,
            error: url.searchParams.get('error') ?? undefined,
            app: resume.mode === 'app' ? appNameFor(resume.url, origin) : undefined,
            signedOut: url.searchParams.get('signed_out') === '1' ? true : undefined,
          },
          title: 'Sign in to Hominem',
        }),
      );
    })
    // The Thames app opens this in a web view with a one-time token from
    // /api/auth/one-time-token/generate. It signs the browser in, then lands on the account page.
    .get('/auth/open', async (c) => {
      const origin = requestOrigin(c);
      const token = c.req.query('token') ?? '';
      const landing = new URL('/auth/settings?app=1', origin).toString();
      c.header('Cache-Control', 'no-store');
      c.header('Referrer-Policy', 'no-referrer');
      if (!token) return c.redirect(landing, 303);
      const verified = await callBetterAuth({
        auth,
        env: inputEnv,
        path: '/one-time-token/verify',
        body: { token },
        request: c.req.raw,
      });
      const headers = new Headers({ location: landing });
      if (verified.ok) {
        for (const setCookie of verified.headers.getSetCookie()) {
          headers.append('set-cookie', setCookie);
        }
      }
      // A bad or used token still lands on the account page, which sends signed-out people to log in.
      headers.set('cache-control', 'no-store');
      headers.set('referrer-policy', 'no-referrer');
      return new Response(null, { status: 303, headers });
    })
    .get('/auth/settings', async (c) => {
      const session = await auth.api.getSession({ headers: c.req.raw.headers });
      const origin = requestOrigin(c);
      if (session?.user) {
        const creditUrl = await creditUrlFor(session.user, origin);
        const creditPence = creditUrl ? await creditBalanceFor(session.user.id) : null;
        return c.html(
          renderAuthShell({
            entry: 'settings',
            init: {
              user: {
                id: session.user.id,
                name: session.user.name,
                email: session.user.email,
              },
              loginNextUrl: new URL('/auth/settings', origin).toString(),
              creditUrl,
              creditPence,
              embedded: c.req.query('app') === '1',
            },
            title: 'Settings | Hominem',
          }),
        );
      }
      // Signed out: take them through hosted login, then drop them back here.
      const settingsUrl = new URL('/auth/settings', origin).toString();
      return c.redirect(
        loginUrlWithEnv(
          { resumeQuery: `next=${encodeURIComponent(settingsUrl)}`, step: 'email' },
          origin,
        ),
        303,
      );
    })
    .get('/auth/settings/ai', async (c) => {
      const session = await auth.api.getSession({ headers: c.req.raw.headers });
      const origin = requestOrigin(c);
      if (session?.user) {
        return c.html(renderAuthShell({ entry: 'settings-ai', title: 'AI usage | Hominem' }));
      }
      const settingsAiUrl = new URL('/auth/settings/ai', origin).toString();
      return c.redirect(
        loginUrlWithEnv(
          { resumeQuery: `next=${encodeURIComponent(settingsAiUrl)}`, step: 'email' },
          origin,
        ),
        303,
      );
    })
    .get('/auth/settings/ai/footprint', async (c) => {
      const session = await auth.api.getSession({ headers: c.req.raw.headers });
      const origin = requestOrigin(c);
      if (session?.user) {
        return c.html(
          renderAuthShell({ entry: 'settings-ai-footprint', title: 'AI footprint | Hominem' }),
        );
      }
      const footprintUrl = new URL('/auth/settings/ai/footprint', origin).toString();
      return c.redirect(
        loginUrlWithEnv(
          { resumeQuery: `next=${encodeURIComponent(footprintUrl)}`, step: 'email' },
          origin,
        ),
        303,
      );
    })
    .get('/auth/settings/credit-history', async (c) => {
      const session = await auth.api.getSession({ headers: c.req.raw.headers });
      if (!session?.user) return c.json({ error: 'unauthorized' }, 401);
      return c.json({ entries: await creditHistory(session.user.id) });
    })
    .get('/auth/settings/export', async (c) => {
      const session = await auth.api.getSession({ headers: c.req.raw.headers });
      if (!session?.user) return c.json({ error: 'unauthorized' }, 401);
      const data = await exportAccount(session.user.id);
      return new Response(JSON.stringify(data, null, 2), {
        headers: {
          'content-type': 'application/json',
          'content-disposition': 'attachment; filename="hominem-data.json"',
          'cache-control': 'no-store',
        },
      });
    })
    // Deleting needs the person's own email typed back, so a stray request cannot end an account.
    .post('/auth/settings/delete', async (c) => {
      const session = await auth.api.getSession({ headers: c.req.raw.headers });
      if (!session?.user) return c.json({ error: 'unauthorized' }, 401);
      const body: unknown = await c.req.json().catch(() => null);
      const typed =
        body && typeof body === 'object' && 'email' in body ? String(body.email).trim() : '';
      if (!session.user.email || typed.toLowerCase() !== session.user.email.toLowerCase()) {
        return c.json({ error: 'Type your email to confirm.' }, 400);
      }
      await deleteAccount(session.user.id, deleteAccountDeps());
      const headers = new Headers({
        'content-type': 'application/json',
        'cache-control': 'no-store',
      });
      return new Response(JSON.stringify({ deleted: true }), { headers });
    })
    .get('/auth/settings/mcp-tokens', async (c) => {
      const session = await auth.api.getSession({ headers: c.req.raw.headers });
      if (!session?.user) return c.json({ error: 'unauthorized' }, 401);
      const result = await listMcpTokens({ ownerUserId: session.user.id });
      return c.json(listMcpTokensOutputSchema.parse({ tokens: result, count: result.length }));
    })
    .post('/auth/settings/mcp-tokens', async (c) => {
      const session = await auth.api.getSession({ headers: c.req.raw.headers });
      if (!session?.user) return c.json({ error: 'unauthorized' }, 401);
      const body = await c.req.json().catch(() => null);
      const parsed = createMcpTokenInputSchema.safeParse(body);
      if (!parsed.success) return c.json({ error: 'Invalid token name.' }, 400);
      const result = await createMcpToken({ ownerUserId: session.user.id, name: parsed.data.name });
      return c.json(createMcpTokenOutputSchema.parse(result), 201);
    })
    .post('/auth/settings/mcp-tokens/:id/revoke', async (c) => {
      const session = await auth.api.getSession({ headers: c.req.raw.headers });
      if (!session?.user) return c.json({ error: 'unauthorized' }, 401);
      const parsed = revokeMcpTokenInputSchema.safeParse({ id: c.req.param('id') });
      if (!parsed.success) return c.json({ error: 'Invalid token id.' }, 400);
      const result = await revokeMcpToken({
        ownerUserId: session.user.id,
        id: parsed.data.id,
      });
      return c.json(revokeMcpTokenOutputSchema.parse(result));
    })
    .get('/auth/settings/oauth-clients', async (c) => {
      const session = await auth.api.getSession({ headers: c.req.raw.headers });
      if (!session?.user) return c.json({ error: 'unauthorized' }, 401);
      const clients = await listOAuthClients({ userId: session.user.id });
      return c.json(listOAuthClientsOutputSchema.parse({ clients }));
    })
    // POST body, not a path param: client ids can be URLs (CIMD), which don't survive a path segment.
    .post('/auth/settings/oauth-clients/revoke', async (c) => {
      const session = await auth.api.getSession({ headers: c.req.raw.headers });
      if (!session?.user) return c.json({ error: 'unauthorized' }, 401);
      const parsed = revokeOAuthClientInputSchema.safeParse(await c.req.json().catch(() => null));
      if (!parsed.success) return c.json({ error: 'Invalid client id.' }, 400);
      const result = await revokeOAuthClient({
        userId: session.user.id,
        clientId: parsed.data.clientId,
      });
      return c.json(revokeOAuthClientOutputSchema.parse(result));
    })
    .post('/auth/settings/profile', async (c) => {
      const form = await c.req.parseBody();
      const name = getFormValue(form, 'name').trim();
      if (!name) return c.json({ error: 'Name cannot be empty.' }, 400);
      const response = await callBetterAuth({
        body: { name },
        path: '/update-user',
        request: c.req.raw,
        auth,
        env: inputEnv,
      });
      if (!response.ok) {
        const message = await response.text().catch(() => null);
        return new Response(JSON.stringify({ error: message || 'Could not save name.' }), {
          headers: { 'content-type': 'application/json' },
          status: response.status,
        });
      }
      // Forward Better Auth's refreshed session cookies (the session payload
      // snapshot the new name) so the browser keeps an up-to-date session.
      const body = await response.text().catch(() => null);
      const headers = copySetCookieHeaders(response.headers);
      headers.set('content-type', 'application/json');
      return new Response(body ?? JSON.stringify({ ok: true }), {
        status: response.status,
        headers,
      });
    })
    .get('/consent', async (c) => {
      const query = new URL(c.req.url).searchParams.toString();
      const consent = resolveConsentQuery(query);
      if (!consent) {
        return c.html(
          renderAuthShell({
            entry: 'error',
            init: { error: 'invalid_request' },
            title: 'Authorization stopped | Hominem',
          }),
          400,
        );
      }
      const session = await auth.api.getSession({ headers: c.req.raw.headers });
      if (!session) return c.redirect(new URL(`/login?${query}`, requestOrigin(c)).toString(), 303);
      const clientResponse = await auth.handler(
        new Request(
          `${inputEnv.API_URL}/api/auth/oauth2/public-client?client_id=${encodeURIComponent(consent.clientId)}`,
          { headers: c.req.raw.headers },
        ),
      );
      let client: { name?: string | null } | null = null;
      if (clientResponse.ok) {
        client = await clientResponse.json();
      }
      return c.html(
        renderAuthShell({
          entry: 'consent',
          init: {
            clientName: client?.name ?? consent.clientId,
            query: consent.query,
            scopes: consent.scopes,
          },
          title: 'Authorize access | Hominem',
        }),
      );
    })
    .get('/error', (c) =>
      c.html(
        renderAuthShell({
          entry: 'error',
          init: {
            description: c.req.query('error_description'),
            error: c.req.query('error'),
            mode:
              c.req.query('mode') === 'app' || c.req.query('mode') === 'oauth'
                ? c.req.query('mode')
                : undefined,
          },
          title: 'Authorization stopped | Hominem',
        }),
      ),
    )
    .get('/logout', async (c) => {
      // Apps send people here with `next`. GET stays read-only (a cross-site
      // navigation or prefetch must not end a session), so a signed-in browser
      // gets a page that POSTs the sign-out itself; a signed-out one just moves on.
      const next = c.req.query('next');
      const resume = next
        ? resolveResumeWithEnv(`next=${encodeURIComponent(next)}`, requestOrigin(c))
        : null;
      if (resume?.mode === 'app') {
        const landing = new URL('/login', requestOrigin(c));
        landing.searchParams.set('next', resume.url);
        landing.searchParams.set('signed_out', '1');
        const active = await auth.api.getSession({ headers: c.req.raw.headers });
        if (!active) return c.redirect(landing.toString(), 303);
        return c.html(
          renderAuthShell({
            entry: 'logout',
            init: { signedOut: false, next: landing.toString() },
            title: 'Signing out | Hominem',
          }),
        );
      }
      const session = await auth.api.getSession({ headers: c.req.raw.headers });
      return c.html(
        renderAuthShell({
          entry: 'logout',
          init: { signedOut: !session },
          title: 'Sign out | Hominem',
        }),
      );
    })
    .post('/logout', async (c) => {
      const [form, response] = await Promise.all([
        c.req.parseBody(),
        callBetterAuth({
          body: {},
          path: '/sign-out',
          request: c.req.raw,
          auth,
          env: inputEnv,
        }),
      ]);
      // Optional post-sign-out destination (used by /auth/settings): redirect
      // there once the session is cleared, falling back to the signed-out page.
      const next = getFormValue(form, 'next');
      const resume = next
        ? resolveResumeWithEnv(`next=${encodeURIComponent(next)}`, requestOrigin(c))
        : null;
      if (resume) {
        const headers = new Headers(response.headers);
        headers.set('location', resume.url);
        return new Response(null, { headers, status: 303 });
      }
      const pageResponse = await c.html(
        renderAuthShell({
          entry: 'logout',
          init: { signedOut: true },
          title: 'Sign out | Hominem',
        }),
      );
      const headers = copySetCookieHeaders(response.headers);
      headers.set('content-type', pageResponse.headers.get('content-type') ?? 'text/html');
      return new Response(await pageResponse.text(), { status: 200, headers });
    })
    .post('/login/send', async (c) => {
      const form = await c.req.parseBody();
      const email = getFormValue(form, 'email');
      const resumeQuery = getFormValue(form, 'resume');
      const origin = requestOrigin(c);
      if (!resolveResumeWithEnv(resumeQuery, origin) || !emailSchema.safeParse(email).success)
        return c.redirect(
          loginUrlWithEnv(
            { error: 'Enter a valid email address.', resumeQuery, step: 'email' },
            origin,
          ),
          303,
        );
      // This calls Better Auth directly, skipping the Hono middleware, so the OTP limits run here too.
      const limit = rateLimitCounter
        ? await checkOtpSendLimits({ counter: rateLimitCounter, email, ip: getClientIp(c) })
        : 'allowed';
      if (limit !== 'allowed')
        return c.redirect(
          loginUrlWithEnv(
            {
              email,
              error:
                limit === 'limited'
                  ? 'Too many codes requested. Wait a few minutes and try again.'
                  : 'Unable to send a verification code. Try again.',
              resumeQuery,
              step: 'email',
            },
            origin,
          ),
          303,
        );
      const response = await callBetterAuth({
        body: { email, type: 'sign-in' },
        path: '/email-otp/send-verification-otp',
        request: c.req.raw,
        auth,
        env: inputEnv,
      });
      if (!response.ok)
        return c.redirect(
          loginUrlWithEnv(
            {
              email,
              error: 'Unable to send a verification code. Try again.',
              resumeQuery,
              step: 'email',
            },
            origin,
          ),
          303,
        );
      return c.redirect(loginUrlWithEnv({ email, resumeQuery, step: 'otp' }, origin), 303);
    })
    .post('/consent/decision', async (c) => {
      const form = await c.req.parseBody();
      const query = getFormValue(form, 'oauth_query');
      const consent = resolveConsentQuery(query);

      if (!consent) {
        return c.html(
          renderAuthShell({
            entry: 'error',
            init: { error: 'invalid_request' },
            title: 'Authorization stopped | Hominem',
          }),
          400,
        );
      }

      const response = await callBetterAuth({
        body: { accept: getFormValue(form, 'accept') === 'true', oauth_query: query },
        path: '/oauth2/consent',
        request: c.req.raw,
        auth,
        env: inputEnv,
      });

      if (!response.ok) {
        return c.html(
          renderAuthShell({
            entry: 'error',
            init: { error: 'access_denied' },
            title: 'Authorization stopped | Hominem',
          }),
          400,
        );
      }

      const body: { redirect_uri?: string; redirect?: boolean; url?: string } | null =
        await response.json().catch(() => null);
      const redirectUrl = body?.redirect_uri ?? (body?.redirect ? body.url : undefined);
      if (!redirectUrl)
        return c.html(
          renderAuthShell({
            entry: 'error',
            init: { error: 'server_error' },
            title: 'Authorization stopped | Hominem',
          }),
          500,
        );
      return c.redirect(redirectUrl, 303);
    })
    .post('/login/verify', async (c) => {
      const form = await c.req.parseBody();
      const email = getFormValue(form, 'email');
      const resumeQuery = getFormValue(form, 'resume');
      const otp = getFormValue(form, 'otp');
      const origin = requestOrigin(c);
      const resume = resolveResumeWithEnv(resumeQuery, origin);
      if (!resume || !emailSchema.safeParse(email).success || !otpSchema.safeParse(otp).success)
        return c.redirect(
          loginUrlWithEnv(
            {
              email,
              error: 'Enter the six-digit verification code.',
              resumeQuery,
              step: 'otp',
            },
            origin,
          ),
          303,
        );
      const response = await callBetterAuth({
        body: { email, otp },
        path: '/sign-in/email-otp',
        request: c.req.raw,
        auth,
        env: inputEnv,
      });
      if (!response.ok && (response.status < 300 || response.status >= 400))
        return c.redirect(
          loginUrlWithEnv(
            {
              email,
              error: 'Verification failed. Check your code and try again.',
              resumeQuery,
              step: 'otp',
            },
            origin,
          ),
          303,
        );
      const postAuthResume = resolvePostAuthResumeWithEnv(resumeQuery, origin) ?? resume;
      const headers = new Headers(response.headers);
      headers.set('location', postAuthResume.url);
      return new Response(null, { headers, status: 303 });
    });

  return loginRoutes;
}

export const loginRoutes = createLoginRoutes({ env, auth: betterAuthServer });
