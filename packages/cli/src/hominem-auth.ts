import { createHash, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { join } from 'node:path';

import { z } from 'zod';

import { waitForCode } from './auth.js';
import { writeFileAtomic } from './files.js';
import { HOMINEM_HOME } from './paths.js';
import { openUrl } from './system.js';

const TOKEN_PATH = join(HOMINEM_HOME, 'hominem_oauth.json');
const SCOPES = 'openid profile email offline_access finance:read finance:write';

const metadataSchema = z.object({
  authorization_endpoint: z.url(),
  token_endpoint: z.url(),
  registration_endpoint: z.url(),
});
const registrationSchema = z.object({ client_id: z.string().min(1) });
const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  expires_in: z.number().positive(),
  token_type: z.string().refine((value) => value.toLowerCase() === 'bearer'),
});
const tokenFileSchema = z.object({
  api_url: z.url(),
  token_endpoint: z.url(),
  client_id: z.string().min(1),
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_at: z.number(),
});

export type HominemToken = z.infer<typeof tokenFileSchema>;

export class HominemAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HominemAuthError';
  }
}

export function hominemApiUrl(): string {
  const url = new URL(process.env.HOMINEM_API_URL ?? 'https://api.ponti.io');
  if (
    url.protocol !== 'https:' &&
    !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
  ) {
    throw new HominemAuthError('HOMINEM_API_URL must use HTTPS or a loopback HTTP address.');
  }
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new HominemAuthError('HOMINEM_API_URL must be an origin without credentials or a path.');
  }
  return url.origin;
}

function sameOrigin(endpoint: string, origin: string): string {
  if (new URL(endpoint).origin !== origin) {
    throw new HominemAuthError(
      'Hominem OAuth discovery returned an endpoint on a different origin.',
    );
  }
  return endpoint;
}

async function json(response: Response, description: string): Promise<unknown> {
  if (!response.ok) throw new HominemAuthError(`${description} failed (HTTP ${response.status}).`);
  return response.json();
}

async function saveToken(token: HominemToken, path = TOKEN_PATH): Promise<void> {
  await writeFileAtomic(path, `${JSON.stringify(token, null, 2)}\n`);
}

export async function loadHominemToken(path = TOKEN_PATH): Promise<HominemToken> {
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      throw new HominemAuthError('Sign in first with `hominem auth hominem`.');
    }
    throw error;
  }
  return tokenFileSchema.parse(JSON.parse(raw));
}

export async function refreshHominemToken(
  token: HominemToken,
  options: { fetchImpl?: typeof fetch; path?: string; now?: number } = {},
): Promise<HominemToken> {
  const endpoint = sameOrigin(token.token_endpoint, new URL(token.api_url).origin);
  const response = await (options.fetchImpl ?? fetch)(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    redirect: 'error',
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: token.refresh_token,
      client_id: token.client_id,
    }),
  });
  const data = tokenResponseSchema.parse(await json(response, 'Hominem token refresh'));
  const refreshed = {
    ...token,
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? token.refresh_token,
    expires_at: (options.now ?? Date.now()) + data.expires_in * 1000,
  };
  await saveToken(refreshed, options.path);
  return refreshed;
}

export async function getHominemAccessToken(): Promise<HominemToken> {
  const token = await loadHominemToken();
  if (token.api_url !== hominemApiUrl()) {
    throw new HominemAuthError('The saved Hominem login is for a different API; sign in again.');
  }
  if (token.expires_at - Date.now() > 60_000) return token;
  return refreshHominemToken(token);
}

export async function hominemAuth(
  options: { fetchImpl?: typeof fetch; path?: string; openUrlImpl?: typeof openUrl } = {},
): Promise<void> {
  const apiUrl = hominemApiUrl();
  const fetchImpl = options.fetchImpl ?? fetch;
  const metadata = metadataSchema.parse(
    await json(
      await fetchImpl(`${apiUrl}/.well-known/oauth-authorization-server`),
      'Hominem OAuth discovery',
    ),
  );
  const authorizationEndpoint = sameOrigin(metadata.authorization_endpoint, apiUrl);
  const tokenEndpoint = sameOrigin(metadata.token_endpoint, apiUrl);
  const registrationEndpoint = sameOrigin(metadata.registration_endpoint, apiUrl);
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (typeof address !== 'object' || address === null) {
    server.close();
    throw new HominemAuthError('Could not bind the local OAuth callback.');
  }
  const redirectUri = `http://127.0.0.1:${address.port}/callback`;
  const resource = `${apiUrl}/api/mcp`;

  try {
    const registration = registrationSchema.parse(
      await json(
        await fetchImpl(registrationEndpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          redirect: 'error',
          body: JSON.stringify({
            client_name: 'Hominem CLI',
            redirect_uris: [redirectUri],
            token_endpoint_auth_method: 'none',
            grant_types: ['authorization_code', 'refresh_token'],
            response_types: ['code'],
            application_type: 'native',
            scope: 'finance:read finance:write',
            resources: [resource],
          }),
        }),
        'Hominem client registration',
      ),
    );
    const verifier = randomBytes(48).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    const state = randomBytes(24).toString('base64url');
    const authorize = new URL(authorizationEndpoint);
    authorize.search = new URLSearchParams({
      response_type: 'code',
      client_id: registration.client_id,
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      redirect_uri: redirectUri,
      scope: SCOPES,
      resource,
    }).toString();
    const codePromise = waitForCode(server, state, 'Hominem');
    console.log('Opening Hominem sign-in. If it does not open, visit:');
    console.log(authorize.toString());
    await (options.openUrlImpl ?? openUrl)(authorize.toString()).catch(() =>
      console.log('(could not open a browser automatically)'),
    );
    const code = await codePromise;
    const data = tokenResponseSchema.parse(
      await json(
        await fetchImpl(tokenEndpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          redirect: 'error',
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri,
            client_id: registration.client_id,
            code_verifier: verifier,
          }),
        }),
        'Hominem sign-in',
      ),
    );
    if (!data.refresh_token)
      throw new HominemAuthError('Hominem did not issue an offline refresh token.');
    await saveToken(
      {
        api_url: apiUrl,
        token_endpoint: tokenEndpoint,
        client_id: registration.client_id,
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: Date.now() + data.expires_in * 1000,
      },
      options.path,
    );
    console.log('Hominem auth: signed in.');
  } finally {
    server.close();
  }
}
