import { strict as assert } from 'node:assert';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';

import { j, rows, runWrapper, tmpDb } from './helpers.ts';

const CLIENT = 'connectors/google-tasks/google_tasks.ts';
const TASKS_SCOPE = 'https://www.googleapis.com/auth/tasks';

let dir: string;
let dbFile: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'hominem-google-tasks-'));
  dbFile = tmpDb(dir);
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function tokenFile(scopes = [TASKS_SCOPE], expires = '2099-01-01T00:00:00.000Z'): string {
  const path = join(dir, 'google-token.json');
  writeFileSync(
    path,
    JSON.stringify({
      type: 'authorized_user',
      token: 'access-secret',
      expiry: expires,
      client_id: 'client-public',
      client_secret: 'client-secret',
      refresh_token: 'refresh-secret',
      token_uri: 'http://token.invalid',
      scopes,
    }),
  );
  return path;
}

async function server(
  handler: (request: IncomingMessage, response: ServerResponse) => void,
): Promise<{ url: string; close: () => Promise<void> }> {
  const instance = createServer(handler);
  await new Promise<void>((resolve) => instance.listen(0, '127.0.0.1', resolve));
  const address = instance.address();
  if (!address || typeof address === 'string') throw new Error('mock server did not bind');
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        instance.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
}

test('google-tasks: missing Tasks scope fails before any external call or event', async () => {
  const token = tokenFile(['https://www.googleapis.com/auth/calendar']);
  const result = await runWrapper(
    CLIENT,
    {
      HOMINEM_AGENT_DB: dbFile,
      GOOGLE_TOKEN_FILE: token,
      GOOGLE_TASKS_API_URL: 'http://127.0.0.1:1',
    },
    ['tasklists'],
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /missing the Tasks scope/);
  assert.deepEqual(rows(dbFile, 'events'), []);
});

test('google-tasks: the access token is never sent to an unknown host', async () => {
  const result = await runWrapper(
    CLIENT,
    {
      HOMINEM_AGENT_DB: dbFile,
      GOOGLE_TOKEN_FILE: tokenFile(),
      GOOGLE_TASKS_API_URL: 'https://tasks.example.invalid/tasks/v1',
    },
    ['tasklists'],
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /must be Google’s Tasks API or a loopback address/);
  assert.deepEqual(rows(dbFile, 'events'), []);
});

test('google-tasks: task-list pagination is returned and audited per page', async () => {
  const mock = await server((request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (url.searchParams.get('pageToken') === 'next') {
      json(response, 200, { items: [{ id: 'monthly-id', title: 'Monthly Cadence' }] });
      return;
    }
    json(response, 200, {
      items: [{ id: 'weekly-id', title: 'Weekly Cadence' }],
      nextPageToken: 'next',
    });
  });
  try {
    const result = await runWrapper(
      CLIENT,
      {
        HOMINEM_AGENT_DB: dbFile,
        GOOGLE_TOKEN_FILE: tokenFile(),
        GOOGLE_TASKS_API_URL: mock.url,
      },
      ['tasklists'],
    );
    assert.equal(result.status, 0);
    assert.deepEqual(
      JSON.parse(result.stdout).items.map((item: { title: string }) => item.title),
      ['Weekly Cadence', 'Monthly Cadence'],
    );
    const events = rows(dbFile, 'events');
    assert.equal(events.length, 2);
    assert.ok(events.every((event) => event['connector'] === 'google-tasks'));
    assert.ok(events.every((event) => event['ok'] === 1));
    assert.equal(j(events[1]!['params']).pageToken, 'next');
  } finally {
    await mock.close();
  }
});

test('google-tasks: inserts a task and audits the request body', async () => {
  let received: Record<string, unknown> | null = null;
  const mock = await server((request, response) => {
    let body = '';
    request.on('data', (chunk) => (body += chunk));
    request.on('end', () => {
      received = JSON.parse(body);
      json(response, 200, { id: 'task-1', title: received!['title'] });
    });
  });
  try {
    const result = await runWrapper(
      CLIENT,
      {
        HOMINEM_AGENT_DB: dbFile,
        GOOGLE_TOKEN_FILE: tokenFile(),
        GOOGLE_TASKS_API_URL: mock.url,
      },
      ['insert', '--tasklist', 'weekly/id', '--json', '{"title":"Finance review"}'],
    );
    assert.equal(result.status, 0);
    assert.deepEqual(received, { title: 'Finance review' });
    const event = rows(dbFile, 'events')[0]!;
    assert.equal(event['http_status'], 200);
    assert.deepEqual(j(event['json_body']), { title: 'Finance review' });
    assert.deepEqual(j(event['command']), ['POST', '/lists/weekly%2Fid/tasks']);
  } finally {
    await mock.close();
  }
});

test('google-tasks: refreshes an expired token and never audits token values', async () => {
  let tokenRequest = '';
  const mock = await server((request, response) => {
    if (request.url === '/token') {
      request.on('data', (chunk) => (tokenRequest += chunk));
      request.on('end', () =>
        json(response, 200, {
          access_token: 'new-access-secret',
          expires_in: 3600,
          scope: TASKS_SCOPE,
        }),
      );
      return;
    }
    json(response, 200, { items: [] });
  });
  const token = tokenFile([TASKS_SCOPE], '2000-01-01T00:00:00.000Z');
  const contents = JSON.parse(readFileSync(token, 'utf8'));
  contents.token_uri = `${mock.url}/token`;
  writeFileSync(token, JSON.stringify(contents));
  try {
    const result = await runWrapper(
      CLIENT,
      {
        HOMINEM_AGENT_DB: dbFile,
        GOOGLE_TOKEN_FILE: token,
        GOOGLE_TASKS_API_URL: mock.url,
      },
      ['tasklists'],
    );
    assert.equal(result.status, 0);
    assert.match(tokenRequest, /grant_type=refresh_token/);
    const saved = JSON.parse(readFileSync(token, 'utf8'));
    assert.equal(saved.token, 'new-access-secret');
    const events = rows(dbFile, 'events');
    assert.equal(events.length, 2);
    assert.equal(events[0]!['service'], 'token');
    assert.deepEqual(j(events[0]!['response']), { token_refreshed: true, expires_in: 3600 });
    const audit = JSON.stringify(events);
    assert.doesNotMatch(audit, /new-access-secret|access-secret|client-secret|refresh-secret/);
  } finally {
    await mock.close();
  }
});

test('google-tasks: API failure is audited without hiding the status', async () => {
  const mock = await server((_request, response) => {
    json(response, 403, {
      error: {
        code: 403,
        message: 'Tasks API access denied',
        status: 'PERMISSION_DENIED',
      },
    });
  });
  try {
    const result = await runWrapper(
      CLIENT,
      {
        HOMINEM_AGENT_DB: dbFile,
        GOOGLE_TOKEN_FILE: tokenFile(),
        GOOGLE_TASKS_API_URL: mock.url,
      },
      ['tasklists'],
    );
    assert.equal(result.status, 1);
    const event = rows(dbFile, 'events')[0]!;
    assert.equal(event['http_status'], 403);
    assert.equal(event['ok'], 0);
    assert.match(result.stderr, /Tasks API access denied/);
  } finally {
    await mock.close();
  }
});
