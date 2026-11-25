#!/usr/bin/env node
/**
 * Spotify connector — official Web API (REST) over OAuth PKCE.
 *
 * The durable route, per the salvage ruling (2026-11-22): the official
 * Spotify Web API with a registered app, not the old mirror hack (that
 * connector died on playlists stuck public, edit-locked, no
 * remove/reorder — see CONNECTOR.md).
 *
 * Auth is PKCE, no client secret: `hominem spotify auth` runs the whole
 * flow (authorize URL → localhost callback → code exchange → store the
 * refresh token in the machine env file). Every API invocation first
 * refreshes the access token, then makes the call.
 *
 * Laws: every external HTTP call lands ONE events row in
 * ~/.hominem/agent.db (connector "spotify") — the token refresh included;
 * token values NEVER reach an events row (sanitized to grant_type +
 * expires_in). Secrets live in the environment (law 4): SPOTIFY_CLIENT_ID
 * and SPOTIFY_REFRESH_TOKEN; a missing variable is a named error, not
 * a guess.
 *
 * Usage (through the launcher):
 *   hominem spotify me
 *   hominem spotify playlists
 *   hominem spotify playlist <playlistId>
 *   hominem spotify search <query...>
 *   hominem spotify create <title> [--public]     # PRIVATE unless --public
 *   hominem spotify add <playlistId> <trackUri...>
 *   hominem spotify remove <playlistId> <trackUri...>
 *   hominem spotify auth                           # PKCE flow, localhost callback
 *   hominem spotify auth --url-only                # print URL + verifier, exit
 *   hominem spotify auth --code <code> --verifier <v>   # manual redirect paste
 *
 * Env (defaults in parens; SPOTIFY_ENV_FILE is where auth stores the
 * token line, replacing any existing line — idempotent, law 3):
 *   SPOTIFY_CLIENT_ID, SPOTIFY_REFRESH_TOKEN,
 *   SPOTIFY_API_URL (https://api.spotify.com/v1),
 *   SPOTIFY_ACCOUNTS_URL (https://accounts.spotify.com),
 *   SPOTIFY_REDIRECT_URI (http://127.0.0.1:8943/callback),
 *   SPOTIFY_SCOPES (read/profile + playlists read/modify),
 *   SPOTIFY_ENV_FILE (~/.hominem/env)
 */
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { logEvent } from '../../log/agent_log.ts';

const CONNECTOR = 'spotify';
const DEFAULT_API = 'https://api.spotify.com/v1';
const DEFAULT_ACCOUNTS = 'https://accounts.spotify.com';
const DEFAULT_REDIRECT = 'http://127.0.0.1:8943/callback';
const DEFAULT_SCOPES =
  'user-read-email user-read-private playlist-read-private playlist-modify-public playlist-modify-private';
const AUTH_TIMEOUT_MS = 5 * 60_000;

/** API/HTTP failure — the events row is already written when it throws. */
class HttpError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown) {
    super(`HTTP ${status}`);
    this.status = status;
    this.body = body;
  }
}

/** Env/config failure — nothing external happened, nothing is logged. */
class NamedError extends Error {}

/**
 * The most human-readable message an error carries: for API failures
 * that's the service's own error text, not just "HTTP 404".
 */
function errorMessage(err: unknown): string {
  if (err instanceof HttpError) {
    if (typeof err.body === 'string') return err.body;
    if (err.body && typeof err.body === 'object') {
      const msg = (err.body as Record<string, unknown>)['message'];
      if (typeof msg === 'string') return msg;
    }
    return `HTTP ${err.status}`;
  }
  return (err as Error).message;
}

function out(obj: unknown): void {
  console.log(JSON.stringify(obj));
}

function now(): { iso: string; ms: number } {
  const t = Date.now();
  return { iso: new Date(t).toISOString(), ms: t };
}

function b64url(buf: Buffer): string {
  return buf.toString('base64url');
}

function newVerifier(): string {
  return b64url(randomBytes(64));
}

function challengeFor(verifier: string): string {
  return b64url(createHash('sha256').update(verifier).digest());
}

function authorizeUrl(
  clientId: string,
  redirect: string,
  challenge: string,
  scopes: string,
  accountsBase: string,
): string {
  const u = new URL(accountsBase + '/authorize');
  u.searchParams.set('client_id', clientId);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('redirect_uri', redirect);
  u.searchParams.set('scope', scopes);
  u.searchParams.set('code_challenge_method', 'S256');
  u.searchParams.set('code_challenge', challenge);
  return u.toString();
}

interface TokenResult {
  refresh_token: string;
  scope: string | null;
}

/**
 * POST to the token endpoint, logged with sanitized params/response —
 * grant_type is all the row ever says about the request; the response
 * row is {token_refreshed|token_stored, expires_in/scope}, never token
 * values (law: secrets never reach events rows).
 */
async function tokenPost(
  form: Record<string, string>,
  rowShape: Record<string, unknown>,
  accountsBase: string,
): Promise<Record<string, unknown>> {
  const tsReq = now();
  const start = performance.now();
  let httpStatus = 0;
  let parsed: Record<string, unknown> = {};
  try {
    const resp = await fetch(accountsBase + '/api/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(form).toString(),
      signal: AbortSignal.timeout(30_000),
    });
    httpStatus = resp.status;
    parsed = (await resp.json().catch(() => ({}))) as Record<string, unknown>;
    if (!resp.ok) {
      throw new HttpError(
        resp.status,
        parsed.error_description ?? parsed.error ?? 'token request failed',
      );
    }
  } catch (err) {
    logEvent(CONNECTOR, ['POST', '/api/token'], {
      ...tsFields(tsReq, start),
      service: 'token',
      params: { grant_type: form['grant_type'] ?? null },
      response: err instanceof HttpError ? err.body : null,
      httpStatus,
      ok: false,
      isError: true,
      error: { error: `http_${httpStatus || 0}`, message: String(errorMessage(err)).slice(0, 300) },
    });
    throw err;
  }
  logEvent(CONNECTOR, ['POST', '/api/token'], {
    ...tsFields(tsReq, start),
    service: 'token',
    params: { grant_type: form['grant_type'] ?? null },
    response: rowShape,
    httpStatus,
    ok: true,
    isError: false,
  });
  return parsed;
}

function tsFields(
  tsReq: { iso: string; ms: number },
  start: number,
): {
  tsRequest: string;
  tsRequestMs: number;
  tsResponse: string;
  tsResponseMs: number;
  durationMs: number;
} {
  const tsRes = now();
  return {
    tsRequest: tsReq.iso,
    tsRequestMs: tsReq.ms,
    tsResponse: tsRes.iso,
    tsResponseMs: tsRes.ms,
    durationMs: Math.round(performance.now() - start),
  };
}

async function refreshAccessToken(
  clientId: string,
  refreshToken: string,
  accountsBase: string,
): Promise<string> {
  const body = await tokenPost(
    {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      // Confidential apps refresh with their secret; PKCE public apps
      // have none and the form just omits it. Never logged either way.
      ...(process.env.SPOTIFY_CLIENT_SECRET
        ? { client_secret: process.env.SPOTIFY_CLIENT_SECRET }
        : {}),
    },
    { token_refreshed: true },
    accountsBase,
  );
  const token = body['access_token'];
  if (typeof token !== 'string' || !token) {
    throw new NamedError('token refresh: no access_token in the response');
  }
  return token;
}

async function exchangeCode(
  clientId: string,
  code: string,
  verifier: string,
  accountsBase: string,
): Promise<TokenResult> {
  const body = await tokenPost(
    {
      grant_type: 'authorization_code',
      code,
      code_verifier: verifier,
      client_id: clientId,
      ...(process.env.SPOTIFY_REDIRECT_URI
        ? { redirect_uri: process.env.SPOTIFY_REDIRECT_URI }
        : { redirect_uri: DEFAULT_REDIRECT }),
      ...(process.env.SPOTIFY_CLIENT_SECRET
        ? { client_secret: process.env.SPOTIFY_CLIENT_SECRET }
        : {}),
    },
    { token_stored: true },
    accountsBase,
  );
  const refresh = body['refresh_token'];
  if (typeof refresh !== 'string' || !refresh) {
    throw new NamedError(
      'auth: the token response had no refresh_token (re-run hominem spotify auth)',
    );
  }
  return { refresh_token: refresh, scope: (body['scope'] as string) ?? null };
}

/**
 * Store the refresh token in the machine env file — replace an existing
 * SPOTIFY_REFRESH_TOKEN line, else append (idempotent, law 3). The
 * value is never echoed to stdout or an events row.
 */
function storeRefreshToken(value: string): string {
  const file = process.env.SPOTIFY_ENV_FILE ?? join(homedir(), '.hominem', 'env');
  const line = `export SPOTIFY_REFRESH_TOKEN="${value}"`;
  let content = '';
  try {
    content = readFileSync(file, 'utf-8');
  } catch {
    content = '';
  }
  const re = /^export SPOTIFY_REFRESH_TOKEN=.*$/m;
  const updated = re.test(content)
    ? content.replace(re, line)
    : `${content.replace(/\n*$/, '\n')}# Spotify Web API — added by hominem spotify auth\n${line}\n`;
  writeFileSync(file, updated.endsWith('\n') ? updated : `${updated}\n`);
  return file;
}

interface ApiOpts {
  params?: Record<string, string>;
  body?: unknown;
}

/** One logged API call (law 1) — the shared transport for every subcommand. */
async function apiCall(
  token: string,
  apiBase: string,
  service: string,
  method: string,
  path: string,
  opts: ApiOpts = {},
): Promise<Record<string, unknown>> {
  const url = new URL(apiBase + path);
  for (const [k, v] of Object.entries(opts.params ?? {})) url.searchParams.set(k, v);
  const tsReq = now();
  const start = performance.now();
  let httpStatus = 0;
  let parsed: unknown = {};
  try {
    const resp = await fetch(url, {
      method,
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${token}`,
        ...(opts.body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: AbortSignal.timeout(30_000),
    });
    httpStatus = resp.status;
    parsed = resp.status === 204 ? {} : await resp.json().catch(() => ({}));
    if (!resp.ok) {
      throw new HttpError(resp.status, (parsed as Record<string, unknown>)['error'] ?? parsed);
    }
  } catch (err) {
    logEvent(CONNECTOR, [method, path], {
      ...tsFields(tsReq, start),
      service,
      params: Object.fromEntries(url.searchParams),
      response: err instanceof HttpError ? err.body : null,
      httpStatus,
      ok: false,
      isError: true,
      error: {
        error: err instanceof HttpError ? `http_${err.status}` : 'network',
        message: String(errorMessage(err)).slice(0, 300),
      },
    });
    throw err;
  }
  logEvent(CONNECTOR, [method, path], {
    ...tsFields(tsReq, start),
    service,
    params: Object.fromEntries(url.searchParams),
    ...(opts.body !== undefined ? { jsonBody: opts.body } : {}),
    response: parsed,
    httpStatus,
    ok: true,
    isError: false,
  });
  return parsed as Record<string, unknown>;
}

function trackLine(t: Record<string, unknown> | null | undefined): Record<string, unknown> {
  return {
    title: t?.['name'] ?? null,
    artists: ((t?.['artists'] as Record<string, unknown>[] | undefined) ?? [])
      .map((artist) => artist['name'])
      .join(', '),
    uri: t?.['uri'] ?? null,
    id: t?.['id'] ?? null,
    duration_ms: t?.['duration_ms'] ?? null,
  };
}

async function cmdAuth(flags: string[]): Promise<number> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  if (!clientId) {
    throw new NamedError(
      'spotify: SPOTIFY_CLIENT_ID is not set — register an app at developer.spotify.com ' +
        '(redirect URI from SPOTIFY_REDIRECT_URI, default http://127.0.0.1:8943/callback) ' +
        'and put its Client ID in the environment.',
    );
  }
  const accountsBase = (process.env.SPOTIFY_ACCOUNTS_URL ?? DEFAULT_ACCOUNTS).replace(/\/$/, '');
  const redirect = process.env.SPOTIFY_REDIRECT_URI ?? DEFAULT_REDIRECT;
  const scopes = process.env.SPOTIFY_SCOPES ?? DEFAULT_SCOPES;

  let urlOnly = false;
  let code: string | null = null;
  let verifierArg: string | null = null;
  for (let i = 0; i < flags.length; i++) {
    const f = flags[i]!;
    if (f === '--url-only') urlOnly = true;
    else if (f === '--code') code = flags[++i] ?? null;
    else if (f === '--verifier') verifierArg = flags[++i] ?? null;
    else throw new NamedError(`spotify auth: unknown flag ${f}`);
  }

  if (urlOnly) {
    const verifier = verifierArg ?? newVerifier();
    out({
      ok: true,
      url: authorizeUrl(clientId, redirect, challengeFor(verifier), scopes, accountsBase),
      verifier,
      redirect_uri: redirect,
      scopes,
      next: 'open the url, complete sign-in, then: hominem spotify auth --code <code> --verifier <verifier>',
    });
    return 0;
  }

  if (code) {
    const verifier = verifierArg;
    if (!verifier)
      throw new NamedError('spotify auth: --code needs --verifier (from the --url-only output)');
    const tok = await exchangeCode(clientId, code, verifier, accountsBase);
    const file = storeRefreshToken(tok.refresh_token);
    out({ ok: true, token_stored: true, env_file: file, scopes: tok.scope ?? scopes });
    return 0;
  }

  // Default: full PKCE flow with a localhost listener. The URL goes to
  // stderr so stdout stays pure JSON for the final result.
  const verifier = verifierArg ?? newVerifier();
  const url = authorizeUrl(clientId, redirect, challengeFor(verifier), scopes, accountsBase);
  const ru = new URL(redirect);
  const port = ru.port ? Number(ru.port) : 8943;
  process.stderr.write(
    `spotify auth: open this URL in a browser and complete sign-in:\n${url}\n` +
      `listening for the redirect at ${redirect} (5 min timeout)...\n`,
  );
  return await new Promise<number>((resolve) => {
    const server = createServer(async (req, res) => {
      const cb = new URL(req.url ?? '/', redirect);
      if (cb.pathname !== ru.pathname) {
        res.writeHead(404).end();
        return;
      }
      const errParam = cb.searchParams.get('error');
      const gotCode = cb.searchParams.get('code');
      if (errParam || !gotCode) {
        res.writeHead(200, { 'content-type': 'text/plain' });
        res.end(`Spotify auth failed: ${errParam ?? 'no code in the redirect'}. Close this tab.`);
        server.close();
        out({ ok: false, error: `auth callback: ${errParam ?? 'no code'}` });
        resolve(2);
        return;
      }
      try {
        const tok = await exchangeCode(clientId, gotCode, verifier, accountsBase);
        storeRefreshToken(tok.refresh_token);
        res.writeHead(200, { 'content-type': 'text/plain' });
        res.end('Spotify connected — you can close this tab.');
        server.close();
        out({ ok: true, token_stored: true });
        resolve(0);
      } catch (err) {
        res.writeHead(200, { 'content-type': 'text/plain' });
        res.end('Spotify auth failed at the token exchange. Close this tab.');
        server.close();
        out({ ok: false, error: String((err as Error).message).slice(0, 300) });
        resolve(2);
      }
    });
    const timer = setTimeout(() => {
      server.close();
      out({ ok: false, error: 'auth: timed out waiting for the redirect (5 min)' });
      resolve(2);
    }, AUTH_TIMEOUT_MS);
    server.on('close', () => clearTimeout(timer));
    server.listen(port, '127.0.0.1');
  });
}

const USAGE = `spotify <command> ...
  me | playlists | playlist <id> | search <query...> |
  create <title> [--public] | add <id> <uri...> | remove <id> <uri...> |
  auth [--url-only | --code <code> --verifier <v>]`;

export async function main(argv = process.argv.slice(2)): Promise<number> {
  const cmd = argv[0];
  if (!cmd) {
    process.stderr.write(`spotify: missing command\n${USAGE}\n`);
    return 2;
  }

  if (cmd === 'auth') {
    try {
      return await cmdAuth(argv.slice(1));
    } catch (err) {
      if (err instanceof NamedError) {
        process.stderr.write(`${(err as Error).message}\n`);
        return 2;
      }
      out({ ok: false, error: String((err as Error).message).slice(0, 300) });
      return 2;
    }
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  if (!clientId) {
    process.stderr.write(
      'spotify: SPOTIFY_CLIENT_ID is not set — register an app at developer.spotify.com ' +
        'and put its Client ID in the environment.\n',
    );
    return 2;
  }
  const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;
  if (!refreshToken) {
    process.stderr.write(
      'spotify: SPOTIFY_REFRESH_TOKEN is not set — run `hominem spotify auth` once.\n',
    );
    return 2;
  }
  const apiBase = (process.env.SPOTIFY_API_URL ?? DEFAULT_API).replace(/\/$/, '');
  const accountsBase = (process.env.SPOTIFY_ACCOUNTS_URL ?? DEFAULT_ACCOUNTS).replace(/\/$/, '');

  try {
    const token = await refreshAccessToken(clientId, refreshToken, accountsBase);

    if (cmd === 'me') {
      const me = await apiCall(token, apiBase, 'me', 'GET', '/me');
      out({
        ok: true,
        id: me['id'] ?? null,
        display_name: me['display_name'] ?? null,
        email: me['email'] ?? null,
        product: me['product'] ?? null,
      });
      return 0;
    }

    if (cmd === 'playlists') {
      const body = await apiCall(token, apiBase, 'playlists', 'GET', '/me/playlists', {
        params: { limit: '50' },
      });
      out(
        ((body['items'] ?? []) as Record<string, unknown>[]).map((p) => ({
          name: p?.name ?? null,
          id: p?.id ?? null,
          public: p?.public ?? null,
          tracks_total: (p?.tracks as Record<string, unknown> | undefined)?.['total'] ?? null,
        })),
      );
      return 0;
    }

    if (cmd === 'playlist') {
      const pid = argv[1];
      if (!pid) throw new NamedError('spotify playlist: missing playlistId');
      const body = await apiCall(
        token,
        apiBase,
        'playlist',
        'GET',
        `/playlists/${encodeURIComponent(pid)}/tracks`,
      );
      out(
        ((body['items'] ?? []) as Record<string, unknown>[]).map((item) =>
          trackLine(item['track'] as Record<string, unknown> | null),
        ),
      );
      return 0;
    }

    if (cmd === 'search') {
      const query = argv.slice(1).join(' ');
      if (!query) throw new NamedError('spotify search: missing query');
      const body = await apiCall(token, apiBase, 'search', 'GET', '/search', {
        params: { q: query, type: 'track', limit: '10' },
      });
      out(
        (
          ((body['tracks'] as Record<string, unknown>)?.['items'] as Record<string, unknown>[]) ??
          []
        ).map(trackLine),
      );
      return 0;
    }

    if (cmd === 'create') {
      const title = argv[1];
      if (!title) throw new NamedError('spotify create: missing title');
      const isPublic = argv.includes('--public');
      const me = await apiCall(token, apiBase, 'create', 'GET', '/me');
      const uid = me['id'];
      if (typeof uid !== 'string' || !uid)
        throw new NamedError('spotify create: /me had no user id');
      const created = await apiCall(
        token,
        apiBase,
        'create',
        'POST',
        `/users/${encodeURIComponent(uid)}/playlists`,
        { body: { name: title, public: isPublic } },
      );
      out({
        ok: true,
        playlistId: created['id'] ?? null,
        url: created['id'] ? `https://open.spotify.com/playlist/${created['id']}` : null,
        public: isPublic,
      });
      return 0;
    }

    if (cmd === 'add' || cmd === 'remove') {
      const pid = argv[1];
      const uris = argv.slice(2);
      if (!pid || uris.length === 0) {
        throw new NamedError(`spotify ${cmd}: needs <playlistId> and at least one track uri`);
      }
      const method = cmd === 'add' ? 'POST' : 'DELETE';
      const body = await apiCall(
        token,
        apiBase,
        cmd,
        method,
        `/playlists/${encodeURIComponent(pid)}/tracks`,
        { body: { uris } },
      );
      out({ ok: true, snapshot_id: body['snapshot_id'] ?? null, uris: uris.length });
      return 0;
    }

    process.stderr.write(`spotify: unknown command ${cmd}\n${USAGE}\n`);
    return 2;
  } catch (err) {
    if (err instanceof NamedError) {
      process.stderr.write(`${(err as Error).message}\n`);
      return 2;
    }
    out({ ok: false, error: String((err as Error).message).slice(0, 300) });
    return 2;
  }
}
