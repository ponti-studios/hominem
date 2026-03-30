import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import os from 'node:os';
import path from 'node:path';

import { settings as oclifSettings } from '@oclif/core';

process.env.HOMINEM_DISABLE_KEYTAR = '1';

const CLI_ROOT = new URL('../..', import.meta.url).pathname;
oclifSettings.enableAutoTranspile = false;

const [{ default: AuthLogin }, { default: AuthLogout }, { default: AuthStatus }] =
  await Promise.all([
    import('../../src/commands/auth/login'),
    import('../../src/commands/auth/logout'),
    import('../../src/commands/auth/status'),
  ]);

interface FakeAuthServer {
  baseUrl: string;
  close: () => Promise<void>;
  state: {
    codeRequests: Array<Record<string, unknown>>;
    tokenRequests: Array<Record<string, unknown>>;
    sessionRequests: string[];
  };
}

async function runCliCommand<T>(
  command: { run: (argv?: string[], opts?: unknown) => Promise<T> },
  argv: string[],
) {
  return command.run(argv, { root: CLI_ROOT, devPlugins: false });
}

async function readJsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }

  const raw = Buffer.concat(chunks).toString('utf-8');
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown) {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(body));
}

async function startFakeAuthServer(): Promise<FakeAuthServer> {
  const state = {
    codeRequests: [] as Array<Record<string, unknown>>,
    tokenRequests: [] as Array<Record<string, unknown>>,
    sessionRequests: [] as string[],
  };

  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');

    if (request.method === 'POST' && url.pathname === '/api/auth/device/code') {
      state.codeRequests.push(await readJsonBody(request));
      sendJson(response, 200, {
        device_code: 'device-code-1',
        user_code: 'ABCD1234',
        verification_uri: 'http://127.0.0.1/device',
        expires_in: 600,
        interval: 0,
      });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/device/token') {
      state.tokenRequests.push(await readJsonBody(request));
      sendJson(response, 200, {
        access_token: 'cli-session-token',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'cli:read',
      });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/auth/session') {
      const authorization = request.headers.authorization ?? '';
      state.sessionRequests.push(authorization);
      sendJson(response, authorization === 'Bearer cli-session-token' ? 200 : 401, {
        isAuthenticated: authorization === 'Bearer cli-session-token',
      });
      return;
    }

    sendJson(response, 404, { error: 'not_found' });
  });

  await new Promise<void>((resolve, reject) => {
    const typedServer = server as Server;
    typedServer.once('error', reject);
    typedServer.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to bind fake auth server');
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
    state,
  };
}

describe('cli auth integration', () => {
  const originalHome = process.env.HOMINEM_HOME;
  let tempHome: string;
  let fakeAuthServer: FakeAuthServer;

  beforeEach(async () => {
    tempHome = await mkdtemp(path.join(os.tmpdir(), 'hominem-cli-auth-'));
    process.env.HOMINEM_HOME = tempHome;
    fakeAuthServer = await startFakeAuthServer();
  });

  afterEach(async () => {
    await fakeAuthServer.close();
    await rm(tempHome, { force: true, recursive: true });
    if (originalHome === undefined) {
      delete process.env.HOMINEM_HOME;
    } else {
      process.env.HOMINEM_HOME = originalHome;
    }
  });

  test('auth login, status, and logout work end-to-end against Better Auth device flow', async () => {
    const loginResult = await runCliCommand(AuthLogin, [
      '--json',
      '--device',
      '--baseUrl',
      fakeAuthServer.baseUrl,
      '--timeoutMs',
      '1000',
    ]);

    expect(loginResult).toEqual({
      authenticated: true,
      mode: 'device',
      baseUrl: fakeAuthServer.baseUrl,
    });
    expect(fakeAuthServer.state.codeRequests).toEqual([
      {
        client_id: 'hominem-cli',
        scope: 'cli:read',
      },
    ]);
    expect(fakeAuthServer.state.tokenRequests).toEqual([
      {
        client_id: 'hominem-cli',
        device_code: 'device-code-1',
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      },
    ]);

    const statusResult = await runCliCommand(AuthStatus, ['--json']);

    expect(statusResult.tokenStored).toBe(true);
    expect(statusResult.authenticated).toBe(true);
    expect(statusResult.provider).toBe('better-auth');
    expect(statusResult.issuerBaseUrl).toBe(fakeAuthServer.baseUrl);
    expect(statusResult.scopes).toEqual(['cli:read']);
    expect(statusResult.ttlSeconds).toBeNumber();
    expect(fakeAuthServer.state.sessionRequests).toEqual(['Bearer cli-session-token']);

    const logoutResult = await runCliCommand(AuthLogout, ['--json']);

    expect(logoutResult).toEqual({ loggedOut: true });

    const postLogoutStatus = await runCliCommand(AuthStatus, ['--json']);

    expect(postLogoutStatus).toEqual({
      tokenStored: false,
      authenticated: false,
      tokenVersion: null,
      provider: null,
      issuerBaseUrl: null,
      expiresAt: null,
      ttlSeconds: null,
      scopes: [],
    });
  });
});
