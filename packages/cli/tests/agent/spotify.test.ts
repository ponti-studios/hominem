/** spotify connector: mock-backend tests (stdlib HTTP server). */
import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';

import { j, rows, runWrapper, tmpDb } from './helpers.ts';

const SPOTIFY = 'connectors/spotify/spotify.ts';

let dir: string;
let dbFile: string;
let server: ReturnType<typeof createServer>;
let port: number;

/** Synthetic track fixture — no real catalog data anywhere in tests. */
const track = (name: string, id: string) => ({
  name,
  artists: [{ name: 'Synthetic Artist' }],
  uri: `spotify:track:${id}`,
  id,
  duration_ms: 180_000,
});

const authed = (req: IncomingMessage) => req.headers.authorization === 'Bearer test-access';

function send(res: ServerResponse, code: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.writeHead(code, { 'content-type': 'application/json', 'content-length': body.length });
  res.end(body);
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => resolve(raw));
  });
}

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'hominem-spotify-'));
  dbFile = tmpDb(dir);
  server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');

    if (req.method === 'POST' && url.pathname === '/api/token') {
      const form = new URLSearchParams(await readBody(req));
      if (form.get('grant_type') === 'refresh_token') {
        if (
          form.get('refresh_token') === 'test-refresh' &&
          form.get('client_id') === 'test-client'
        ) {
          send(res, 200, { access_token: 'test-access', token_type: 'Bearer', expires_in: 3600 });
        } else {
          send(res, 400, { error: 'invalid_grant' });
        }
        return;
      }
      if (form.get('grant_type') === 'authorization_code') {
        if (form.get('code') === 'test-code' && form.get('code_verifier') === 'test-verifier') {
          send(res, 200, {
            access_token: 'test-access',
            refresh_token: 'fresh-refresh',
            scope: 'playlist-read-private',
          });
        } else {
          send(res, 400, { error: 'invalid_grant' });
        }
        return;
      }
      send(res, 400, { error: 'unsupported_grant_type' });
      return;
    }

    if (!authed(req)) {
      send(res, 401, { error: { message: 'no bearer' } });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/v1/me') {
      send(res, 200, {
        id: 'testuid',
        display_name: 'Test User',
        email: 'test@lvh.me',
        product: 'premium',
      });
      return;
    }
    if (req.method === 'GET' && url.pathname === '/v1/me/playlists') {
      send(res, 200, {
        items: [{ name: 'Synthetic List', id: 'PL1', public: false, tracks: { total: 7 } }],
      });
      return;
    }
    if (req.method === 'GET' && url.pathname === '/v1/playlists/PL1/tracks') {
      send(res, 200, { items: [{ track: track('Synthetic Song', 'T1') }] });
      return;
    }
    if (req.method === 'GET' && url.pathname === '/v1/search') {
      if (url.searchParams.get('q') === 'two words' && url.searchParams.get('type') === 'track') {
        send(res, 200, { tracks: { items: [track('Two Words Song', 'T2')] } });
      } else {
        send(res, 200, { tracks: { items: [] } });
      }
      return;
    }
    if (req.method === 'GET' && url.pathname === '/v1/playlists/MISSING/tracks') {
      send(res, 404, { error: { message: 'synthetic not found' } });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/v1/users/testuid/playlists') {
      const body = JSON.parse((await readBody(req)) || '{}');
      send(res, 201, { id: 'NEWPL', name: body.name, public: body.public });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/v1/playlists/PL1/tracks') {
      const body = JSON.parse((await readBody(req)) || '{}');
      send(res, 201, { snapshot_id: 'snap-add', added: body.uris?.length ?? 0 });
      return;
    }
    if (req.method === 'DELETE' && url.pathname === '/v1/playlists/PL1/tracks') {
      const body = JSON.parse((await readBody(req)) || '{}');
      send(res, 200, { snapshot_id: 'snap-remove', removed: body.uris?.length ?? 0 });
      return;
    }
    send(res, 404, { error: { message: `no mock route for ${req.method} ${url.pathname}` } });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = (server.address() as { port: number }).port;
});

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  rmSync(dir, { recursive: true, force: true });
});

function apiEnv(): Record<string, string> {
  return {
    HOMINEM_AGENT_DB: dbFile,
    SPOTIFY_CLIENT_ID: 'test-client',
    SPOTIFY_REFRESH_TOKEN: 'test-refresh',
    SPOTIFY_API_URL: `http://127.0.0.1:${port}/v1`,
    SPOTIFY_ACCOUNTS_URL: `http://127.0.0.1:${port}`,
  };
}

test('spotify: missing SPOTIFY_CLIENT_ID is a named error, nothing external', async () => {
  // Blanked explicitly: runWrapper merges the ambient process env, and
  // this Mac's agent env carries the salvage-era app credentials.
  const p = await runWrapper(SPOTIFY, { HOMINEM_AGENT_DB: dbFile, SPOTIFY_CLIENT_ID: '' }, ['me']);
  assert.equal(p.status, 2);
  assert.match(p.stderr, /SPOTIFY_CLIENT_ID/);
  assert.equal(rows(dbFile, 'events').length, 0);
});

test('spotify: missing SPOTIFY_REFRESH_TOKEN is a named error, nothing external', async () => {
  const p = await runWrapper(
    SPOTIFY,
    { HOMINEM_AGENT_DB: dbFile, SPOTIFY_CLIENT_ID: 'test-client', SPOTIFY_REFRESH_TOKEN: '' },
    ['me'],
  );
  assert.equal(p.status, 2);
  assert.match(p.stderr, /SPOTIFY_REFRESH_TOKEN/);
  assert.equal(rows(dbFile, 'events').length, 0);
});

test('spotify: me refreshes then reads; token row carries no token values', async () => {
  const p = await runWrapper(SPOTIFY, apiEnv(), ['me']);
  assert.equal(p.status, 0);
  const body = JSON.parse(p.stdout);
  assert.equal(body.id, 'testuid');
  assert.equal(body.display_name, 'Test User');

  const all = rows(dbFile, 'events');
  assert.equal(all.length, 2); // token + me, one row per external call
  const tokenRow = all.find((r) => r['service'] === 'token')!;
  assert.equal(tokenRow['ok'], 1);
  assert.equal(tokenRow['is_error'], 0);
  const rowText = JSON.stringify(tokenRow);
  assert.ok(!rowText.includes('test-access'), 'access token leaked into events');
  assert.ok(!rowText.includes('test-refresh'), 'refresh token leaked into events');
  const meRow = all.find((r) => r['service'] === 'me')!;
  assert.equal(j(meRow['response']).id, 'testuid');
  assert.equal(meRow['http_status'], 200);
});

test('spotify: playlists normalized from the library page', async () => {
  const p = await runWrapper(SPOTIFY, apiEnv(), ['playlists']);
  assert.equal(p.status, 0);
  const body = JSON.parse(p.stdout);
  assert.equal(body.length, 1);
  assert.equal(body[0].name, 'Synthetic List');
  assert.equal(body[0].id, 'PL1');
  assert.equal(body[0].tracks_total, 7);
  const row = rows(dbFile, 'events').find((r) => r['service'] === 'playlists')!;
  assert.deepEqual(j(row['params']), { limit: '50' });
});

test('spotify: playlist tracks normalized', async () => {
  const p = await runWrapper(SPOTIFY, apiEnv(), ['playlist', 'PL1']);
  assert.equal(p.status, 0);
  const body = JSON.parse(p.stdout);
  assert.equal(body[0].title, 'Synthetic Song');
  assert.equal(body[0].uri, 'spotify:track:T1');
});

test('spotify: search passes the query verbatim', async () => {
  const p = await runWrapper(SPOTIFY, apiEnv(), ['search', 'two', 'words']);
  assert.equal(p.status, 0);
  const body = JSON.parse(p.stdout);
  assert.equal(body[0].title, 'Two Words Song');
  const row = rows(dbFile, 'events').find((r) => r['service'] === 'search')!;
  assert.equal(j(row['params']).q, 'two words');
  assert.equal(j(row['params']).type, 'track');
});

test('spotify: create resolves the user id, then posts (3 rows, PRIVATE default)', async () => {
  const p = await runWrapper(SPOTIFY, apiEnv(), ['create', 'New List']);
  assert.equal(p.status, 0);
  const body = JSON.parse(p.stdout);
  assert.equal(body.playlistId, 'NEWPL');
  assert.equal(body.public, false);
  assert.ok(body.url.includes('NEWPL'));

  const all = rows(dbFile, 'events');
  assert.equal(all.length, 3); // token + me + create
  const createRow = all.find((r) => j(r['command'])[1]?.includes('playlists'))!;
  assert.equal(createRow['http_status'], 201);
  assert.deepEqual(j(createRow['json_body']), { name: 'New List', public: false });
});

test('spotify: add and remove playlist items', async () => {
  const add = await runWrapper(SPOTIFY, apiEnv(), [
    'add',
    'PL1',
    'spotify:track:T1',
    'spotify:track:T2',
  ]);
  assert.equal(add.status, 0);
  assert.equal(JSON.parse(add.stdout).snapshot_id, 'snap-add');

  const remove = await runWrapper(SPOTIFY, apiEnv(), ['remove', 'PL1', 'spotify:track:T1']);
  assert.equal(remove.status, 0);
  assert.equal(JSON.parse(remove.stdout).snapshot_id, 'snap-remove');

  const removeRow = rows(dbFile, 'events').find((r) => r['service'] === 'remove')!;
  assert.equal(j(removeRow['command'])[0], 'DELETE');
  assert.deepEqual(j(removeRow['json_body']).uris, ['spotify:track:T1']);
  assert.equal(removeRow['http_status'], 200);
});

test('spotify: API 404 is a named error row and an in-band failure', async () => {
  const p = await runWrapper(SPOTIFY, apiEnv(), ['playlist', 'MISSING']);
  assert.equal(p.status, 2);
  assert.equal(JSON.parse(p.stdout).ok, false);
  const row = rows(dbFile, 'events').find((r) => r['service'] === 'playlist')!;
  assert.equal(row['is_error'], 1);
  assert.equal(row['http_status'], 404);
  assert.equal(j(row['error']).error, 'http_404');
  assert.match(j(row['error']).message, /synthetic not found/);
});

test('spotify: a dead refresh token fails the whole invocation at the token row', async () => {
  const env = { ...apiEnv(), SPOTIFY_REFRESH_TOKEN: 'wrong' };
  const p = await runWrapper(SPOTIFY, env, ['playlists']);
  assert.equal(p.status, 2);
  assert.equal(JSON.parse(p.stdout).ok, false);
  const all = rows(dbFile, 'events');
  assert.equal(all.length, 1); // only the token call happened
  assert.equal(all[0]!['service'], 'token');
  assert.equal(all[0]!['is_error'], 1);
  assert.equal(all[0]!['http_status'], 400);
});

test('spotify: auth --url-only builds a correct PKCE URL with no external calls', async () => {
  const env = { HOMINEM_AGENT_DB: dbFile, SPOTIFY_CLIENT_ID: 'test-client' };
  const p = await runWrapper(SPOTIFY, env, ['auth', '--url-only']);
  assert.equal(p.status, 0);
  const body = JSON.parse(p.stdout);
  const u = new URL(body.url);
  assert.equal(u.searchParams.get('client_id'), 'test-client');
  assert.equal(u.searchParams.get('response_type'), 'code');
  assert.equal(u.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(u.searchParams.get('redirect_uri'), 'http://127.0.0.1:8943/callback');
  assert.match(u.searchParams.get('scope') ?? '', /playlist-modify-private/);
  // the challenge is the S256 of the printed verifier
  const expect = createHash('sha256').update(body.verifier).digest().toString('base64url');
  assert.equal(u.searchParams.get('code_challenge'), expect);
  assert.equal(rows(dbFile, 'events').length, 0);
});

test('spotify: auth --code exchanges and stores the token; the row never echoes it', async () => {
  const envFile = join(dir, 'env');
  const env = {
    HOMINEM_AGENT_DB: dbFile,
    SPOTIFY_CLIENT_ID: 'test-client',
    SPOTIFY_ACCOUNTS_URL: `http://127.0.0.1:${port}`,
    SPOTIFY_ENV_FILE: envFile,
  };
  const p = await runWrapper(SPOTIFY, env, [
    'auth',
    '--code',
    'test-code',
    '--verifier',
    'test-verifier',
  ]);
  assert.equal(p.status, 0);
  assert.equal(JSON.parse(p.stdout).token_stored, true);

  const content = readFileSync(envFile, 'utf-8');
  assert.match(content, /export SPOTIFY_REFRESH_TOKEN="fresh-refresh"/);
  const tokenRow = rows(dbFile, 'events')[0]!;
  assert.ok(
    !JSON.stringify(tokenRow).includes('fresh-refresh'),
    'refresh token leaked into events',
  );
  assert.equal(tokenRow['service'], 'token');
});

test('spotify: re-auth replaces the stored line, never duplicates (law 3)', async () => {
  const envFile = join(dir, 'env');
  writeFileSync(envFile, 'export SPOTIFY_REFRESH_TOKEN="stale-old"\n');
  const env = {
    HOMINEM_AGENT_DB: dbFile,
    SPOTIFY_CLIENT_ID: 'test-client',
    SPOTIFY_ACCOUNTS_URL: `http://127.0.0.1:${port}`,
    SPOTIFY_ENV_FILE: envFile,
  };
  const p = await runWrapper(SPOTIFY, env, [
    'auth',
    '--code',
    'test-code',
    '--verifier',
    'test-verifier',
  ]);
  assert.equal(p.status, 0);
  const content = readFileSync(envFile, 'utf-8');
  assert.equal((content.match(/export SPOTIFY_REFRESH_TOKEN/g) ?? []).length, 1);
  assert.ok(!content.includes('stale-old'));
});

test('spotify: auth with a bad verifier fails at the exchange row', async () => {
  const env = {
    HOMINEM_AGENT_DB: dbFile,
    SPOTIFY_CLIENT_ID: 'test-client',
    SPOTIFY_ACCOUNTS_URL: `http://127.0.0.1:${port}`,
    SPOTIFY_ENV_FILE: join(dir, 'env'),
  };
  const p = await runWrapper(SPOTIFY, env, ['auth', '--code', 'test-code', '--verifier', 'wrong']);
  assert.equal(p.status, 2);
  assert.equal(JSON.parse(p.stdout).ok, false);
  const tokenRow = rows(dbFile, 'events')[0]!;
  assert.equal(tokenRow['is_error'], 1);
  assert.equal(tokenRow['http_status'], 400);
});
