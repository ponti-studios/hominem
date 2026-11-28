import { createHash, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { z } from 'zod';

import { writeFileAtomic } from './files.ts';
import { CLIENT_SECRET_PATH, TOKEN_PATH } from './paths.ts';

// Same full scope set as the Python setup.py default (`--services all`), so
// the token keeps working for Gmail, Calendar, Drive, Docs, Sheets, Contacts.
export const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.settings.readonly',
  'https://www.googleapis.com/auth/contacts.readonly',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/tasks',
];

const clientSecretSchema = z.object({
  installed: z.object({
    client_id: z.string(),
    client_secret: z.string(),
    auth_uri: z.string(),
    token_uri: z.string(),
  }),
});

export const tokenFileSchema = z.object({
  token: z.string(),
  refresh_token: z.string(),
  token_uri: z.string(),
  client_id: z.string(),
  client_secret: z.string(),
  // The Python skill's file may omit these. Only the five fields above are needed to refresh.
  scopes: z.array(z.string()).optional(),
  universe_domain: z.string().optional(),
  account: z.string().optional(),
  expiry: z.string().optional(),
  type: z.string().optional(),
});

const tokenResponseSchema = z.object({
  access_token: z.string(),
  expires_in: z.number(),
  refresh_token: z.string().optional(),
  scope: z.string().optional(),
});

export type ClientSecret = z.infer<typeof clientSecretSchema>['installed'];
export type TokenFile = z.infer<typeof tokenFileSchema>;

export class GoogleAuthError extends Error {
  readonly code:
    | 'TOKEN_MISSING'
    | 'TOKEN_REVOKED'
    | 'REFRESH_FAILED'
    | 'API_UNAUTHORIZED'
    | 'API_FAILED'
    | 'NETWORK';

  constructor(
    code:
      | 'TOKEN_MISSING'
      | 'TOKEN_REVOKED'
      | 'REFRESH_FAILED'
      | 'API_UNAUTHORIZED' // Google said no: the token is dead
      | 'API_FAILED' // Google errored: we can't tell
      | 'NETWORK',
    message: string,
  ) {
    super(message);
    this.code = code;
  }
}

export async function loadClient(): Promise<ClientSecret> {
  const raw = await readFile(CLIENT_SECRET_PATH, 'utf8').catch(() => {
    throw new GoogleAuthError('TOKEN_MISSING', `No client secret at ${CLIENT_SECRET_PATH}`);
  });
  return clientSecretSchema.parse(JSON.parse(raw)).installed;
}

export async function loadToken(): Promise<TokenFile> {
  const raw = await readFile(TOKEN_PATH, 'utf8').catch(() => {
    throw new GoogleAuthError('TOKEN_MISSING', `No token at ${TOKEN_PATH}`);
  });
  return tokenFileSchema.parse(JSON.parse(raw));
}

async function saveToken(token: TokenFile, path = TOKEN_PATH): Promise<void> {
  await writeFileAtomic(
    path,
    `${JSON.stringify(token, null, 2)}
`,
  );
}

// What the shell passes in, so tests can swap the network, clock and disk.
export type Deps = {
  fetch: typeof fetch;
  now: () => number;
  save: (token: TokenFile) => Promise<void>;
};
const defaultDeps: Deps = { fetch, now: Date.now, save: (token) => saveToken(token) };

// Offline surfaces as a TypeError from fetch; say so instead of looking like a dead token.
async function send(deps: Deps, input: string, init?: RequestInit): Promise<Response> {
  try {
    return await deps.fetch(input, init);
  } catch (error) {
    throw new GoogleAuthError(
      'NETWORK',
      `Could not reach Google: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

// Google's tokens expire ~hourly; refresh once the access token is close to it.
export function isFresh(token: TokenFile, now: number): boolean {
  // No expiry on file means we can't trust the access token: refresh.
  return token.expiry !== undefined && Date.parse(token.expiry) - now > 60_000;
}

// `invalid_grant` means the refresh token was revoked or expired; anything else may be transient.
export function classifyRefreshFailure(body: string): 'TOKEN_REVOKED' | 'REFRESH_FAILED' {
  return body.includes('invalid_grant') ? 'TOKEN_REVOKED' : 'REFRESH_FAILED';
}

export async function refreshToken(
  token: TokenFile,
  overrides: Partial<Deps> = {},
): Promise<TokenFile> {
  const deps = { ...defaultDeps, ...overrides };
  const response = await send(deps, token.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: token.client_id,
      client_secret: token.client_secret,
      refresh_token: token.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    const code = classifyRefreshFailure(body);
    throw new GoogleAuthError(code, `${code}: ${body}`);
  }
  const data = tokenResponseSchema.parse(await response.json());
  const refreshed: TokenFile = {
    ...token,
    token: data.access_token,
    // Google rarely rotates the refresh token, but when it does the old one stops working.
    refresh_token: data.refresh_token ?? token.refresh_token,
    expiry: new Date(deps.now() + data.expires_in * 1000).toISOString(),
  };
  await deps.save(refreshed);
  return refreshed;
}

// Returns a usable access token, refreshing and saving when needed.
async function accessToken(overrides: Partial<Deps> = {}): Promise<string> {
  const deps = { ...defaultDeps, ...overrides };
  const token = await loadToken();
  return isFresh(token, deps.now()) ? token.token : (await refreshToken(token, deps)).token;
}

// The real health check: refresh if needed, then make one API call.
export async function checkLive(overrides: Partial<Deps> = {}): Promise<void> {
  const deps = { ...defaultDeps, ...overrides };
  const access = await accessToken(deps);
  const response = await send(deps, 'https://www.googleapis.com/drive/v3/about?fields=user', {
    headers: { Authorization: `Bearer ${access}` },
  });
  if (!response.ok) {
    const quota = response.status === 403 && isQuotaError(await response.text().catch(() => ''));
    const code =
      !quota && (response.status === 401 || response.status === 403)
        ? 'API_UNAUTHORIZED'
        : 'API_FAILED';
    throw new GoogleAuthError(code, `Drive API returned ${response.status}`);
  }
}

const QUOTA_REASONS = new Set([
  'userRateLimitExceeded',
  'rateLimitExceeded',
  'dailyLimitExceeded',
  'quotaExceeded',
  'storageQuotaExceeded',
]);

// A 403 can mean "slow down" rather than "signed out"; only the error reason tells them apart.
export function isQuotaError(body: string): boolean {
  try {
    const parsed = z
      .object({ error: z.object({ errors: z.array(z.object({ reason: z.string() })) }) })
      .safeParse(JSON.parse(body));
    return parsed.success && parsed.data.error.errors.some((e) => QUOTA_REASONS.has(e.reason));
  } catch {
    return false;
  }
}

// PKCE (RFC 7636): verifier stays local, challenge goes in the consent URL.
export function makePkce() {
  const verifier = randomBytes(64).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

export function buildAuthUrl(options: {
  client: ClientSecret;
  redirectUri: string;
  state: string;
  challenge: string;
}): string {
  const url = new URL(options.client.auth_uri);
  url.search = new URLSearchParams({
    client_id: options.client.client_id,
    redirect_uri: options.redirectUri,
    response_type: 'code',
    scope: SCOPES.join(' '),
    state: options.state,
    code_challenge: options.challenge,
    code_challenge_method: 'S256',
    access_type: 'offline',
    prompt: 'consent',
  }).toString();
  return url.toString();
}

export async function exchangeCode(
  options: {
    client: ClientSecret;
    code: string;
    redirectUri: string;
    verifier: string;
  },
  overrides: Partial<Deps> = {},
): Promise<TokenFile> {
  const deps = { ...defaultDeps, ...overrides };
  const response = await send(deps, options.client.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: options.client.client_id,
      client_secret: options.client.client_secret,
      code: options.code,
      code_verifier: options.verifier,
      grant_type: 'authorization_code',
      redirect_uri: options.redirectUri,
    }),
  });
  if (!response.ok) {
    throw new GoogleAuthError('REFRESH_FAILED', `Token exchange failed: ${await response.text()}`);
  }
  const data = tokenResponseSchema.parse(await response.json());
  if (!data.refresh_token) {
    throw new GoogleAuthError(
      'REFRESH_FAILED',
      'Google did not return a refresh token. Try again.',
    );
  }
  const token: TokenFile = {
    token: data.access_token,
    refresh_token: data.refresh_token,
    token_uri: options.client.token_uri,
    client_id: options.client.client_id,
    client_secret: options.client.client_secret,
    // Store what Google actually granted, not what we asked for.
    scopes: data.scope ? data.scope.split(' ') : SCOPES,
    universe_domain: 'googleapis.com',
    account: '',
    expiry: new Date(deps.now() + data.expires_in * 1000).toISOString(),
    type: 'authorized_user',
  };
  await deps.save(token);
  return token;
}
