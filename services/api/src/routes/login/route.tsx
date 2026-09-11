import { join } from 'node:path';

import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { etag } from 'hono/etag';

import { betterAuthServer } from '../../auth/better-auth';
import { env } from '../../env';
import type { AuthDependencies } from '../auth/shared';
import { AuthErrorPage } from './components/auth-error-page';
import { ConsentPage } from './components/consent-page';
import { LoginPage } from './components/login-page';
import { LogoutPage } from './components/logout-page';
import { SettingsPage } from './components/settings-page';
import {
  emailSchema,
  getFormValue,
  loginUrl,
  otpSchema,
  resolveConsentQuery,
  resolvePostAuthResume,
  resolveResume,
} from './helpers';

const logoPath = join(process.cwd(), 'public', 'logo.hominem.500x500.webp');
const cssPath = join(process.cwd(), 'public', 'login.css');
const jsPath = join(process.cwd(), 'public', 'login.js');
const settingsJsPath = join(process.cwd(), 'public', 'settings.js');

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
  const { env: inputEnv, auth } = dependencies;
  const resolveResumeWithEnv = (query: string) => resolveResume(query, inputEnv);
  const resolvePostAuthResumeWithEnv = (query: string) => resolvePostAuthResume(query, inputEnv);
  const loginUrlWithEnv = (value: Parameters<typeof loginUrl>[0]) => loginUrl(value, inputEnv);

  const loginRoutes = new Hono()
    .use('/login.css', etag(), serveAsset(cssPath, 'text/css; charset=UTF-8'))
    .use('/login.js', etag(), serveAsset(jsPath, 'text/javascript; charset=UTF-8'))
    .use('/settings.js', etag(), serveAsset(settingsJsPath, 'text/javascript; charset=UTF-8'))
    .use('/logo.hominem.500x500.webp', etag(), serveAsset(logoPath, 'image/webp'))
    .get('/login', async (c) => {
      const url = new URL(c.req.url);
      const resumeQuery = url.searchParams.toString();
      const resume = resolveResumeWithEnv(resumeQuery);
      if (!resume)
        return c.html(
          <AuthErrorPage
            description="Open the sign-in link from the app or client you came from."
            error="invalid_request"
          />,
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
        <LoginPage
          email={email}
          error={url.searchParams.get('error') ?? undefined}
          mode={resume.mode}
          resumeQuery={resumeQuery}
          step={step}
        />,
      );
    })
    .get('/auth/settings', async (c) => {
      const session = await auth.api.getSession({ headers: c.req.raw.headers });
      if (session?.user) {
        return c.html(
          <SettingsPage
            loginNextUrl={new URL('/auth/settings', inputEnv.API_URL).toString()}
            user={session.user}
          />,
        );
      }
      // Signed out: take them through hosted login, then drop them back here.
      const settingsUrl = new URL('/auth/settings', inputEnv.API_URL).toString();
      return c.redirect(
        loginUrlWithEnv({ resumeQuery: `next=${encodeURIComponent(settingsUrl)}`, step: 'email' }),
        303,
      );
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
      if (!consent) return c.html(<AuthErrorPage error="invalid_request" />, 400);
      const session = await auth.api.getSession({ headers: c.req.raw.headers });
      if (!session) return c.redirect(new URL(`/login?${query}`, inputEnv.API_URL).toString(), 303);
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
        <ConsentPage
          clientName={client?.name ?? consent.clientId}
          query={consent.query}
          scopes={consent.scopes}
        />,
      );
    })
    .get('/error', (c) =>
      c.html(
        <AuthErrorPage
          description={c.req.query('error_description')}
          error={c.req.query('error')}
        />,
      ),
    )
    .get('/logout', async (c) => {
      const session = await auth.api.getSession({ headers: c.req.raw.headers });
      return c.html(<LogoutPage signedOut={!session} />);
    })
    .post('/logout', async (c) => {
      const form = await c.req.parseBody();
      const response = await callBetterAuth({
        body: {},
        path: '/sign-out',
        request: c.req.raw,
        auth,
        env: inputEnv,
      });
      // Optional post-sign-out destination (used by /auth/settings): redirect
      // there once the session is cleared, falling back to the signed-out page.
      const next = getFormValue(form, 'next');
      const resume = next ? resolveResumeWithEnv(`next=${encodeURIComponent(next)}`) : null;
      if (resume) {
        const headers = new Headers(response.headers);
        headers.set('location', resume.url);
        return new Response(null, { headers, status: 303 });
      }
      const pageResponse = await c.html(<LogoutPage signedOut />);
      const headers = copySetCookieHeaders(response.headers);
      headers.set('content-type', pageResponse.headers.get('content-type') ?? 'text/html');
      return new Response(await pageResponse.text(), { status: 200, headers });
    })
    .post('/login/send', async (c) => {
      const form = await c.req.parseBody();
      const email = getFormValue(form, 'email');
      const resumeQuery = getFormValue(form, 'resume');
      if (!resolveResumeWithEnv(resumeQuery) || !emailSchema.safeParse(email).success)
        return c.redirect(
          loginUrlWithEnv({ error: 'Enter a valid email address.', resumeQuery, step: 'email' }),
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
          loginUrlWithEnv({
            email,
            error: 'Unable to send a verification code. Try again.',
            resumeQuery,
            step: 'email',
          }),
          303,
        );
      return c.redirect(loginUrlWithEnv({ email, resumeQuery, step: 'otp' }), 303);
    })
    .post('/consent/decision', async (c) => {
      const form = await c.req.parseBody();
      const query = getFormValue(form, 'oauth_query');
      const consent = resolveConsentQuery(query);

      if (!consent) {
        return c.html(<AuthErrorPage error="invalid_request" />, 400);
      }

      const response = await callBetterAuth({
        body: { accept: getFormValue(form, 'accept') === 'true', oauth_query: query },
        path: '/oauth2/consent',
        request: c.req.raw,
        auth,
        env: inputEnv,
      });

      if (!response.ok) {
        return c.html(<AuthErrorPage error="access_denied" />, 400);
      }

      const body: { redirect_uri?: string; redirect?: boolean; url?: string } | null =
        await response.json().catch(() => null);
      const redirectUrl = body?.redirect_uri ?? (body?.redirect ? body.url : undefined);
      if (!redirectUrl) return c.html(<AuthErrorPage error="server_error" />, 500);
      return c.redirect(redirectUrl, 303);
    })
    .post('/login/verify', async (c) => {
      const form = await c.req.parseBody();
      const email = getFormValue(form, 'email');
      const resumeQuery = getFormValue(form, 'resume');
      const otp = getFormValue(form, 'otp');
      const resume = resolveResumeWithEnv(resumeQuery);
      if (!resume || !emailSchema.safeParse(email).success || !otpSchema.safeParse(otp).success)
        return c.redirect(
          loginUrlWithEnv({
            email,
            error: 'Enter the six-digit verification code.',
            resumeQuery,
            step: 'otp',
          }),
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
          loginUrlWithEnv({
            email,
            error: 'Verification failed. Check your code and try again.',
            resumeQuery,
            step: 'otp',
          }),
          303,
        );
      const postAuthResume = resolvePostAuthResumeWithEnv(resumeQuery) ?? resume;
      const headers = new Headers(response.headers);
      headers.set('location', postAuthResume.url);
      return new Response(null, { headers, status: 303 });
    });

  return loginRoutes;
}

export const loginRoutes = createLoginRoutes({ env, auth: betterAuthServer });
