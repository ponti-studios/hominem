import { execFile } from 'node:child_process';
/**
 * End-to-end smoke test for the hosted MCP endpoint.
 *
 * Usage:
 *   pnpm --filter @hominem/api mcp:smoke                         # OAuth flow (opens a browser)
 *   pnpm --filter @hominem/api mcp:smoke -- --token hmt_...      # personal MCP token
 *   MCP_TOKEN=hmt_... pnpm --filter @hominem/api mcp:smoke
 *   pnpm --filter @hominem/api mcp:smoke -- --url http://localhost:4040/api/mcp
 *   pnpm --filter @hominem/api mcp:smoke -- --no-open            # print the authorize URL instead
 *   pnpm --filter @hominem/api mcp:smoke -- --h2                 # force HTTP/2 (curl-like) requests
 *
 * By default requests use Node's HTTP/1.1 fetch, like most server-side fetchers (including
 * AI-agent connectors). If Cloudflare challenges that traffic, step 1 fails with a diagnosis;
 * --h2 lets the rest of the flow run so app-level behavior can still be verified.
 *
 * Checks, in order:
 *   1. Unauthenticated POST returns 401 with a Bearer resource_metadata challenge
 *   2. Protected-resource and authorization-server metadata resolve
 *   3. Auth (personal token, or dynamic client registration + PKCE authorization code flow)
 *   4. MCP initialize -> notifications/initialized -> tools/list
 *   5. tools/call on a read-only tool, then resources/list and prompts/list
 */
import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { parseArgs } from 'node:util';

const { values: args } = parseArgs({
  // pnpm forwards a literal `--` separator to the script; drop it.
  args: process.argv.slice(2).filter((arg) => arg !== '--'),
  options: {
    url: { type: 'string' },
    token: { type: 'string' },
    'no-open': { type: 'boolean', default: false },
    h2: { type: 'boolean', default: false },
    timeout: { type: 'string', default: '180' },
  },
  allowPositionals: false,
  strict: true,
});

const mcpUrl = new URL(args.url ?? process.env.MCP_URL ?? 'https://api.ponti.io/api/mcp');
const token = args.token ?? process.env.MCP_TOKEN;
const authTimeoutMs = Number(args.timeout) * 1000;
const PROTOCOL_VERSION = '2026-07-28';

// Read tools that need no arguments, in order of preference.
const PREFERRED_READ_TOOLS = [
  'finance_accounts',
  'finance_net_worth',
  'career_profile',
  'list_memories',
];

type Json = Record<string, unknown>;

// Node's global fetch accepts an undici `dispatcher`; an Agent with allowH2 upgrades to HTTP/2.
const dispatcher = args.h2 ? new (await import('undici')).Agent({ allowH2: true }) : undefined;

function http(input: string | URL, init: RequestInit = {}) {
  const options: RequestInit & { dispatcher?: unknown } = { ...init, dispatcher };
  return fetch(input, options);
}

let failures = 0;

function pass(step: string, detail = '') {
  console.log(`  ok    ${step}${detail ? ` - ${detail}` : ''}`);
}

function fail(step: string, detail: string): never {
  failures += 1;
  console.error(`  FAIL  ${step} - ${detail}`);
  console.error(`\nmcp smoke test failed against ${mcpUrl.href}`);
  process.exit(1);
}

async function getJson(step: string, url: string): Promise<Json> {
  const response = await http(url, { headers: { accept: 'application/json' } });
  if (!response.ok) fail(step, `GET ${url} returned HTTP ${response.status}`);
  return (await response.json()) as Json;
}

/** MCP responses may be plain JSON or a single SSE `data:` event. */
async function readMcpBody(response: Response): Promise<Json> {
  const text = await response.text();
  if (!text) return {};
  if (
    response.headers.get('content-type')?.includes('text/event-stream') ||
    text.startsWith('event:')
  ) {
    const data = text
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .at(-1)
      ?.slice(5)
      .trim();
    return JSON.parse(data ?? '{}') as Json;
  }
  return JSON.parse(text) as Json;
}

function base64Url(buffer: Buffer) {
  return buffer.toString('base64url');
}

function openBrowser(url: string) {
  const opener =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  execFile(opener, [url], () => {});
}

/** Starts a loopback listener and resolves with the authorization code once redirected back. */
function listenForCallback(expectedState: string) {
  let resolveCode: (code: string) => void = () => {};
  let rejectCode: (error: Error) => void = () => {};
  const codePromise = new Promise<string>((resolve, reject) => {
    resolveCode = resolve;
    rejectCode = reject;
  });

  const server = createServer((request, response) => {
    const callbackUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
    if (callbackUrl.pathname !== '/callback') {
      response.writeHead(404).end();
      return;
    }
    const error = callbackUrl.searchParams.get('error');
    const code = callbackUrl.searchParams.get('code');
    const state = callbackUrl.searchParams.get('state');
    response.writeHead(200, { 'content-type': 'text/plain' });
    if (error) {
      response.end(`Authorization failed: ${error}. You can close this tab.`);
      rejectCode(new Error(`authorization server returned error=${error}`));
    } else if (!code || state !== expectedState) {
      response.end('Invalid callback. You can close this tab.');
      rejectCode(new Error('callback missing code or state mismatch'));
    } else {
      response.end('Authorized. You can close this tab and return to the terminal.');
      resolveCode(code);
    }
  });

  const ready = new Promise<number>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port));
  });

  return { ready, codePromise, close: () => server.close() };
}

async function obtainOAuthToken(): Promise<string> {
  const resourceMetadataUrl = new URL(
    `/.well-known/oauth-protected-resource${mcpUrl.pathname}`,
    mcpUrl.origin,
  ).href;
  const resource = await getJson('protected-resource metadata', resourceMetadataUrl);
  const authServer = (resource.authorization_servers as string[] | undefined)?.[0];
  if (!authServer) fail('protected-resource metadata', 'no authorization_servers listed');
  const scopes = (resource.scopes_supported as string[] | undefined) ?? [];
  pass('protected-resource metadata', `authorization server ${authServer}`);

  // RFC 8414 puts the well-known segment between host and path; fall back to the
  // origin-level document, which this API also serves.
  const authUrl = new URL(authServer);
  const candidates = [
    new URL(`/.well-known/oauth-authorization-server${authUrl.pathname}`, authUrl.origin).href,
    new URL('/.well-known/oauth-authorization-server', authUrl.origin).href,
  ];
  let metadata: Json | undefined;
  for (const candidate of candidates) {
    const response = await http(candidate, { headers: { accept: 'application/json' } });
    if (response.ok) {
      metadata = (await response.json()) as Json;
      break;
    }
  }
  if (!metadata) fail('authorization-server metadata', `none of ${candidates.join(', ')} resolved`);

  const authorizationEndpoint = metadata.authorization_endpoint as string | undefined;
  const tokenEndpoint = metadata.token_endpoint as string | undefined;
  const registrationEndpoint = metadata.registration_endpoint as string | undefined;
  if (!authorizationEndpoint || !tokenEndpoint || !registrationEndpoint) {
    fail('authorization-server metadata', 'missing authorize/token/registration endpoint');
  }
  const methods = (metadata.code_challenge_methods_supported as string[] | undefined) ?? [];
  if (!methods.includes('S256')) fail('authorization-server metadata', 'PKCE S256 not supported');
  pass('authorization-server metadata', 'authorize + token + register + S256');

  const state = base64Url(randomBytes(16));
  const callback = listenForCallback(state);
  const port = await callback.ready;
  const redirectUri = `http://127.0.0.1:${port}/callback`;

  try {
    const registration = await http(registrationEndpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        client_name: 'hominem mcp smoke test',
        redirect_uris: [redirectUri],
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
        application_type: 'native',
        scope: scopes.join(' '),
      }),
    });
    const registered = (await registration.json()) as Json;
    if (!registration.ok || typeof registered.client_id !== 'string') {
      fail(
        'dynamic client registration',
        `HTTP ${registration.status} ${JSON.stringify(registered)}`,
      );
    }
    const clientId = registered.client_id as string;
    pass('dynamic client registration', `client_id ${clientId}`);

    const verifier = base64Url(randomBytes(32));
    const challenge = base64Url(createHash('sha256').update(verifier).digest());
    const authorize = new URL(authorizationEndpoint as string);
    authorize.search = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: scopes.join(' '),
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      resource: resource.resource as string,
    }).toString();

    console.log(`\n  Sign in and approve access in the browser:\n  ${authorize.href}\n`);
    if (!args['no-open']) openBrowser(authorize.href);

    const timer = setTimeout(
      () => fail('authorization', `no callback within ${authTimeoutMs / 1000}s`),
      authTimeoutMs,
    );
    const code = await callback.codePromise.catch((error: Error) =>
      fail('authorization', error.message),
    );
    clearTimeout(timer);
    pass('authorization code received');

    const tokenResponse = await http(tokenEndpoint as string, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        code_verifier: verifier,
        resource: resource.resource as string,
      }),
    });
    const tokens = (await tokenResponse.json()) as Json;
    if (!tokenResponse.ok || typeof tokens.access_token !== 'string') {
      fail('token exchange', `HTTP ${tokenResponse.status} ${JSON.stringify(tokens)}`);
    }
    pass('token exchange', `scope "${tokens.scope ?? ''}"`);
    return tokens.access_token as string;
  } finally {
    callback.close();
  }
}

async function rpc(accessToken: string, sessionId: string | undefined, body: Json) {
  const response = await http(mcpUrl, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      'mcp-protocol-version': PROTOCOL_VERSION,
      ...(sessionId ? { 'mcp-session-id': sessionId } : {}),
    },
    body: JSON.stringify(body),
  });
  return response;
}

async function main() {
  console.log(`Target: ${mcpUrl.href}\n`);

  // 1. Unauthenticated challenge
  const probe = await http(mcpUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 0, method: 'ping' }),
  });
  const challenge = probe.headers.get('www-authenticate') ?? '';
  if (probe.headers.get('cf-mitigated') === 'challenge') {
    fail(
      'unauthenticated challenge',
      `Cloudflare returned a challenge (HTTP ${probe.status}, cf-mitigated: challenge) before the request reached the API. ` +
        'Custom WAF rules that challenge HTTP/1.1 clients (e.g. "block.legacy") catch agent connectors. ' +
        `Add a Skip rule, ordered first, for host ${mcpUrl.host} and path prefix ${mcpUrl.pathname}. ` +
        'Re-run with --h2 to test the rest of the flow past it.',
    );
  }
  if (probe.status === 403 && probe.headers.get('server') === 'cloudflare') {
    fail(
      'unauthenticated challenge',
      'Cloudflare blocked the request (HTTP 403, no challenge). A custom WAF rule such as "block.ai-crawlers" ' +
        `may match this client's user agent. Add a Skip rule, ordered first, for host ${mcpUrl.host} and path prefix ${mcpUrl.pathname}.`,
    );
  }
  if (probe.status !== 401) fail('unauthenticated challenge', `expected 401, got ${probe.status}`);
  if (!/^Bearer\b/i.test(challenge) || !challenge.includes('resource_metadata=')) {
    fail('unauthenticated challenge', `WWW-Authenticate missing resource_metadata: "${challenge}"`);
  }
  pass('unauthenticated challenge', '401 + Bearer resource_metadata');

  // 2-3. Credentials
  let accessToken: string;
  if (token) {
    accessToken = token;
    pass('auth', 'using provided token (OAuth flow skipped)');
  } else {
    accessToken = await obtainOAuthToken();
  }

  // 4. MCP handshake
  const init = await rpc(accessToken, undefined, {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'hominem-mcp-smoke-test', version: '1.0.0' },
    },
  });
  if (!init.ok) fail('initialize', `HTTP ${init.status} ${(await init.text()).slice(0, 300)}`);
  const sessionId = init.headers.get('mcp-session-id') ?? undefined;
  const initBody = await readMcpBody(init);
  const serverInfo = (initBody.result as Json | undefined)?.serverInfo as Json | undefined;
  if (!serverInfo) fail('initialize', `no serverInfo in ${JSON.stringify(initBody).slice(0, 300)}`);
  pass(
    'initialize',
    `${serverInfo.name} ${serverInfo.version ?? ''}${sessionId ? ' (session)' : ' (stateless)'}`.trim(),
  );

  await rpc(accessToken, sessionId, { jsonrpc: '2.0', method: 'notifications/initialized' });

  const list = await rpc(accessToken, sessionId, { jsonrpc: '2.0', id: 2, method: 'tools/list' });
  if (!list.ok) fail('tools/list', `HTTP ${list.status} ${(await list.text()).slice(0, 300)}`);
  const listBody = await readMcpBody(list);
  const tools =
    ((listBody.result as Json | undefined)?.tools as Array<{ name: string }> | undefined) ?? [];
  if (tools.length === 0)
    fail('tools/list', `no tools returned: ${JSON.stringify(listBody).slice(0, 300)}`);
  pass('tools/list', `${tools.length} tools`);
  for (const tool of tools) console.log(`          - ${tool.name}`);

  let nextId = 3;
  async function call(step: string, method: string, params?: Json): Promise<Json> {
    const response = await rpc(accessToken, sessionId, {
      jsonrpc: '2.0',
      id: nextId++,
      method,
      ...(params ? { params } : {}),
    });
    if (!response.ok)
      fail(step, `HTTP ${response.status} ${(await response.text()).slice(0, 300)}`);
    const body = await readMcpBody(response);
    if (body.error) fail(step, `JSON-RPC error ${JSON.stringify(body.error).slice(0, 300)}`);
    return (body.result as Json | undefined) ?? {};
  }

  const toolNames = new Set(tools.map((tool) => tool.name));
  const readTool = PREFERRED_READ_TOOLS.find((name) => toolNames.has(name));
  if (readTool) {
    const result = await call(`tools/call ${readTool}`, 'tools/call', {
      name: readTool,
      arguments: {},
    });
    if (result.isError) {
      fail(
        `tools/call ${readTool}`,
        `tool returned isError: ${JSON.stringify(result.content).slice(0, 300)}`,
      );
    }
    if (!result.structuredContent) {
      fail(`tools/call ${readTool}`, 'result has no structuredContent');
    }
    pass(
      `tools/call ${readTool}`,
      `keys: ${Object.keys(result.structuredContent as Json).join(', ')}`,
    );
  } else {
    console.log('  skip  tools/call - none of the preferred read tools are granted to this token');
  }

  const resources = await call('resources/list', 'resources/list');
  const resourceList = (resources.resources as Array<{ uri: string }> | undefined) ?? [];
  pass('resources/list', `${resourceList.length} resources`);
  for (const resource of resourceList.slice(0, 5)) console.log(`          - ${resource.uri}`);

  const prompts = await call('prompts/list', 'prompts/list');
  const promptList = (prompts.prompts as Array<{ name: string }> | undefined) ?? [];
  pass('prompts/list', `${promptList.length} prompts`);
  for (const prompt of promptList) console.log(`          - ${prompt.name}`);

  console.log(`\nmcp smoke test passed against ${mcpUrl.href}`);
}

await main();
process.exit(failures === 0 ? 0 : 1);
