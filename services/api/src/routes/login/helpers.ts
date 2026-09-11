import {
  resolveAppRedirectUrl,
  resolveOAuthResumeUrl,
} from '@ponti-studios/auth/shared/redirect-policy';
import { z } from 'zod';

import { getTrustedOrigins } from '../../auth/better-auth';
import { env } from '../../env';
import { MCP_SCOPES } from '../../scopes';

export const emailSchema = z.string().email();
export const otpSchema = z.string().length(6);

export type ResumeMode = 'app' | 'oauth';
export type Resume = { mode: ResumeMode; url: string };

export function getFormValue(form: Record<string, string | File>, name: string) {
  const value = form[name];
  return typeof value === 'string' ? value : '';
}

export function resolveResume(
  query: string,
  inputEnv = env,
  requestOrigin?: string,
): Resume | null {
  const params = new URLSearchParams(query);
  const next = params.get('next');
  if (next !== null) {
    // The incoming request's own origin is implicitly trusted: it's the host
    // the browser actually reached (the portless proxy surfaces hosts on 443
    // while the env URLs carry the app's internal port), and allowing a
    // resume back to the auth host itself is harmless.
    const trustedOrigins = requestOrigin
      ? [...getTrustedOrigins(inputEnv), requestOrigin]
      : getTrustedOrigins(inputEnv);
    const url = resolveAppRedirectUrl(next, trustedOrigins);
    return url ? { mode: 'app', url } : null;
  }

  const url = resolveOAuthResumeUrl(query, inputEnv.API_URL);
  return url ? { mode: 'oauth', url } : null;
}

// The OAuth authorize endpoint (`@better-auth/oauth-provider`) unconditionally
// bounces back to `loginPage` whenever the original request carried
// `prompt=login`/`prompt=create` or an unsatisfiable `max_age` (0 is defined
// by the OIDC spec to never be satisfied) — it re-checks those raw query
// params on every hit, with no session-freshness exemption on this direct
// entry point (that exemption only lives inside the plugin's own
// `/oauth2/consent` and `/oauth2/continue` endpoints, which this app's OTP
// login form never calls). Since we just authenticated the user, those
// constraints are satisfied; strip them so resuming into `/oauth2/authorize`
// doesn't immediately redirect back to `/login` and loop forever.
function clearSatisfiedLoginConstraints(url: string): string {
  const parsed = new URL(url);
  const remainingPrompts = parsed.searchParams
    .get('prompt')
    ?.split(' ')
    .filter((prompt) => prompt !== 'login' && prompt !== 'create');
  if (remainingPrompts?.length) parsed.searchParams.set('prompt', remainingPrompts.join(' '));
  else parsed.searchParams.delete('prompt');
  parsed.searchParams.delete('max_age');
  return parsed.toString();
}

// Use after a successful sign-in, instead of resolveResume, to build the
// redirect target: an 'oauth' resume needs the just-satisfied login
// constraints cleared first (see clearSatisfiedLoginConstraints); an 'app'
// resume points at another origin entirely and carries no such params.
export function resolvePostAuthResume(
  query: string,
  inputEnv = env,
  requestOrigin?: string,
): Resume | null {
  const resume = resolveResume(query, inputEnv, requestOrigin);
  if (!resume || resume.mode !== 'oauth') return resume;
  return { mode: 'oauth', url: clearSatisfiedLoginConstraints(resume.url) };
}

export function loginUrl(
  input: {
    email?: string;
    error?: string;
    origin?: string;
    resumeQuery: string;
    step: 'email' | 'otp';
  },
  inputEnv = env,
) {
  // Redirect targets are consumed by the browser, so build them from the
  // origin the browser actually used (the incoming request's origin) rather
  // than the configured API_URL — behind the portless proxy those differ in
  // development (443 vs the env's internal port), and match in production.
  const base = input.origin ?? inputEnv.API_URL;
  const url = new URL('/login', base);
  const query = new URLSearchParams(input.resumeQuery);
  query.set('step', input.step);
  if (input.email) query.set('email', input.email);
  if (input.error) query.set('error', input.error);
  url.search = query.toString();
  return url.toString();
}

export function resolveConsentQuery(query: string) {
  const params = new URLSearchParams(query);
  const clientId = params.get('client_id');
  const redirectUri = params.get('redirect_uri');
  const signature = params.get('sig');
  const expiry = Number(params.get('exp'));
  if (!clientId || !redirectUri || !signature || !Number.isSafeInteger(expiry)) return null;
  if (expiry <= Math.floor(Date.now() / 1000)) return null;
  const scopeSet = new Set<string>(MCP_SCOPES);
  const scopes = (params.get('scope') ?? '').split(' ').filter((scope) => scopeSet.has(scope));
  return { clientId, scopes, query };
}
