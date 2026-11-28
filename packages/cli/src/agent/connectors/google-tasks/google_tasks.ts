#!/usr/bin/env node
import { chmodSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import {
  isFresh,
  loadToken,
  refreshToken,
  type TokenFile as HominemToken,
  tokenFileSchema,
} from '../../../google.ts';
import { asRecord, errorText, isRecord, optionalString } from '../../guards.ts';
import { logEvent } from '../../log/agent_log.ts';

const CONNECTOR = 'google-tasks';
const TASKS_SCOPE = 'https://www.googleapis.com/auth/tasks';
const DEFAULT_API = 'https://tasks.googleapis.com/tasks/v1';

type TokenFile = HominemToken & { scope?: unknown };

// Passthrough keeps the older space-separated `scope` field.
const savedTokenSchema = tokenFileSchema.passthrough();

class NamedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleTasksError';
  }
}

class HttpError extends Error {
  status: number;
  body: Record<string, unknown>;

  constructor(status: number, body: Record<string, unknown>) {
    const error = asRecord(body['error']) ?? body;
    super(typeof error['message'] === 'string' ? error['message'] : `HTTP ${status}`);
    this.status = status;
    this.body = body;
  }
}

function now(): { iso: string; ms: number } {
  const ms = Date.now();
  return { iso: new Date(ms).toISOString(), ms };
}

function auditTimes(started: number, request: { iso: string; ms: number }) {
  const response = now();
  return {
    tsRequest: request.iso,
    tsRequestMs: request.ms,
    tsResponse: response.iso,
    tsResponseMs: response.ms,
    durationMs: Math.round(performance.now() - started),
  };
}

function tokenPath(): string {
  if (process.env.GOOGLE_TOKEN_FILE) return process.env.GOOGLE_TOKEN_FILE;
  const home = process.env.HOMINEM_HOME || join(homedir(), '.hominem');
  return join(home, 'google_token.json');
}

function readToken(path: string): TokenFile {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (err) {
    throw new NamedError(`Google token could not be read at ${path}: ${errorText(err)}`);
  }
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch (err) {
    throw new NamedError(`Google token is not valid JSON at ${path}: ${errorText(err)}`);
  }
  if (!isRecord(value)) throw new NamedError(`Google token at ${path} is not an object`);
  const token = savedTokenSchema.safeParse(value);
  if (!token.success) {
    throw new NamedError(`Google token at ${path} is missing fields needed to refresh it`);
  }
  return token.data;
}

function scopes(token: TokenFile): Set<string> {
  if (Array.isArray(token.scopes)) {
    return new Set(token.scopes.filter((scope): scope is string => typeof scope === 'string'));
  }
  if (typeof token.scope === 'string') return new Set(token.scope.split(/\s+/).filter(Boolean));
  return new Set();
}

function assertTasksScope(token: TokenFile): void {
  const granted = scopes(token);
  if (granted.size > 0 && granted.has(TASKS_SCOPE)) return;
  throw new NamedError(
    `Google token is missing the Tasks scope (${TASKS_SCOPE}). Re-authorize Google Workspace access with Tasks enabled.`,
  );
}

function needsRefresh(token: TokenFile): boolean {
  return !isFresh(token, Date.now());
}

async function refresh(path: string, token: TokenFile): Promise<TokenFile> {
  const started = performance.now();
  const request = now();
  try {
    const customSave = process.env.GOOGLE_TOKEN_FILE;
    const next = await refreshToken(
      token,
      customSave
        ? {
            save: async (refreshed) => {
              const temp = `${path}.tmp`;
              writeFileSync(temp, `${JSON.stringify(refreshed, null, 2)}\n`, { mode: 0o600 });
              chmodSync(temp, 0o600);
              renameSync(temp, path);
            },
          }
        : {},
    );
    const expiresIn = next.expiry
      ? Math.max(0, Math.round((Date.parse(next.expiry) - Date.now()) / 1000))
      : 0;
    logEvent(CONNECTOR, ['POST', '/token'], {
      ...auditTimes(started, request),
      service: 'token',
      params: { grant_type: 'refresh_token' },
      response: { token_refreshed: true, expires_in: expiresIn },
      httpStatus: 200,
      ok: true,
      isError: false,
    });
    return next;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logEvent(CONNECTOR, ['POST', '/token'], {
      ...auditTimes(started, request),
      service: 'token',
      params: { grant_type: 'refresh_token' },
      response: null,
      ok: false,
      isError: true,
      error: { error: 'token_refresh_failed', message },
    });
    throw err;
  }
}

async function accessToken(): Promise<string> {
  const path = tokenPath();
  let token = process.env.GOOGLE_TOKEN_FILE ? readToken(path) : await loadToken();
  assertTasksScope(token);
  if (needsRefresh(token)) token = await refresh(path, token);
  if (!token.token) throw new NamedError('Google token has no access token');
  return token.token;
}

/** The access token only ever goes to Google, or to a loopback stand-in for tests. */
function apiBase(): string {
  const url = new URL(process.env.GOOGLE_TASKS_API_URL ?? DEFAULT_API);
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.origin !== new URL(DEFAULT_API).origin && !loopback) {
    throw new NamedError('GOOGLE_TASKS_API_URL must be Google’s Tasks API or a loopback address.');
  }
  return url.href.replace(/\/$/, '');
}

async function apiCall(
  token: string,
  method: 'GET' | 'POST',
  pathname: string,
  params: Record<string, string> = {},
  body?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const url = new URL(`${apiBase()}${pathname}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const started = performance.now();
  const request = now();
  let status = 0;
  try {
    const response = await fetch(url, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(30_000),
    });
    status = response.status;
    const parsed = asRecord(await response.json().catch(() => ({}))) ?? {};
    if (!response.ok) throw new HttpError(status, parsed);
    logEvent(CONNECTOR, [method, pathname], {
      ...auditTimes(started, request),
      service: 'tasks',
      params,
      jsonBody: body,
      response: parsed,
      httpStatus: status,
      ok: true,
      isError: false,
    });
    return parsed;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logEvent(CONNECTOR, [method, pathname], {
      ...auditTimes(started, request),
      service: 'tasks',
      params,
      jsonBody: body,
      response: err instanceof HttpError ? err.body : null,
      httpStatus: status || undefined,
      ok: false,
      isError: true,
      error: { error: err instanceof HttpError ? `http_${status}` : 'request_failed', message },
    });
    throw err;
  }
}

function stringArg(args: string[], flag: string): string | null {
  const index = args.indexOf(flag);
  if (index < 0 || index + 1 >= args.length) return null;
  return args[index + 1] ?? null;
}

async function listAll(
  token: string,
  pathname: string,
  params: Record<string, string>,
): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let pageToken: string | null = null;
  do {
    const page = await apiCall(token, 'GET', pathname, {
      ...params,
      ...(pageToken ? { pageToken } : {}),
    });
    const pageItems = page['items'] ?? [];
    if (!Array.isArray(pageItems))
      throw new NamedError(`${pathname} returned a non-array items field`);
    for (const item of pageItems) {
      if (isRecord(item)) items.push(item);
    }
    pageToken = typeof page['nextPageToken'] === 'string' ? page['nextPageToken'] : null;
  } while (pageToken);
  return items;
}

export async function executeTasks(args: string[]): Promise<Record<string, unknown>> {
  const command = args[0];
  const token = await accessToken();
  if (command === 'tasklists') {
    const items = await listAll(token, '/users/@me/lists', { maxResults: '100' });
    return { items };
  }

  const tasklist = stringArg(args, '--tasklist');
  if (!tasklist) throw new NamedError(`google-tasks ${command ?? ''}: missing --tasklist`);

  if (command === 'list') {
    const items = await listAll(token, `/lists/${encodeURIComponent(tasklist)}/tasks`, {
      maxResults: '100',
      showCompleted: 'false',
      showHidden: 'false',
    });
    return { items };
  }

  if (command === 'insert') {
    const raw = stringArg(args, '--json');
    if (!raw) throw new NamedError('google-tasks insert: missing --json');
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch (err) {
      throw new NamedError(`google-tasks insert: invalid JSON: ${errorText(err)}`);
    }
    if (!isRecord(body) || typeof body['title'] !== 'string') {
      throw new NamedError('google-tasks insert: --json must contain a string title');
    }
    return apiCall(token, 'POST', `/lists/${encodeURIComponent(tasklist)}/tasks`, {}, body);
  }
  throw new NamedError('google-tasks: expected tasklists, list, or insert');
}

export async function main(args = process.argv.slice(2)): Promise<number> {
  try {
    const result = await executeTasks(args);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return 0;
  } catch (err) {
    process.stderr.write(`google-tasks: ${err instanceof Error ? err.message : String(err)}\n`);
    return 1;
  }
}

export function taskListId(items: Record<string, unknown>[], title: string): string | null {
  const matches = items.filter((item) => item['title'] === title && typeof item['id'] === 'string');
  if (matches.length !== 1) return null;
  return optionalString(matches[0]?.['id']) ?? null;
}
