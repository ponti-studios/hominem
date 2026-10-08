/**
 * In-process performance baseline for the MCP server.
 *
 * Drives the real production handler (`handleMcpRequest`) through an in-memory
 * Hono app with a fake auth context — no network, no auth middleware, no rate
 * limiter — so the numbers isolate the per-request cost of the MCP server
 * itself. `createMcpHandler` rebuilds the whole `McpServer` (the factory in
 * `server.ts`) on every request, so `tools/list` latency is dominated by that
 * construction: ~110 `registerTool` calls + `describeCapability` string
 * building + schema serialization. That is exactly the cost a memoization
 * change would remove.
 *
 * Usage:
 *   pnpm --filter @hominem/api exec tsx --tsconfig tsconfig.dev.json scripts/mcp-perf-baseline.ts
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { Hono } from 'hono';

import type { AuthContext } from '../src/auth/types';
import { ensureMcpToolsRegistered } from '../src/mcp/register-tools';
import { handleMcpRequest, type McpHonoEnv } from '../src/mcp/server';
import { describeCapability } from '../src/mcp/tool-planner';
import { listToolsForScopes } from '../src/mcp/tool-registry';
import { MCP_SCOPES } from '../src/scopes';

const ITERATIONS = Number(process.env.MCP_PERF_ITERATIONS ?? 200);
const WARMUP = 20;

const BENCH_USER_ID = '00000000-0000-4000-8000-000000000000';

const auth: AuthContext = {
  user: {
    id: BENCH_USER_ID,
    email: 'bench@test.hominem.dev',
    emailVerified: true,
    name: 'Bench User',
    image: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  userId: BENCH_USER_ID,
  clientId: 'bench-client',
  credential: 'mcp-token',
  scopes: [...MCP_SCOPES],
};

type Sample = number[];

type MetricStats = {
  n: number;
  meanMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
  minMs: number;
};

function stats(samples: Sample): MetricStats {
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, value) => acc + value, 0);
  const pct = (p: number) =>
    sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
  const round = (value: number) => Number(value.toFixed(3));
  return {
    n: sorted.length,
    meanMs: round(sum / sorted.length),
    p50Ms: round(pct(50)),
    p95Ms: round(pct(95)),
    p99Ms: round(pct(99)),
    maxMs: round(pct(100)),
    minMs: round(pct(0)),
  };
}

function summarize(label: string, samples: Sample, unit = 'ms') {
  const s = stats(samples);
  console.log(
    `${label.padEnd(28)} n=${String(s.n).padStart(4)}  mean=${s.meanMs
      .toFixed(2)
      .padStart(8)}${unit}  p50=${s.p50Ms.toFixed(2).padStart(8)}${unit}  p95=${s.p95Ms
      .toFixed(2)
      .padStart(8)}${unit}  p99=${s.p99Ms.toFixed(2).padStart(8)}${unit}  max=${s.maxMs
      .toFixed(2)
      .padStart(8)}${unit}`,
  );
}

async function time<T>(run: () => Promise<T>, samples: Sample): Promise<T> {
  const started = performance.now();
  const result = await run();
  samples.push(performance.now() - started);
  return result;
}

function gitSha(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function pkgVersion(name: string): string {
  const require = createRequire(import.meta.url);
  try {
    let dir = dirname(require.resolve(name));
    while (dir !== dirname(dir)) {
      const manifest = join(dir, 'package.json');
      if (existsSync(manifest)) {
        const pkg: { version: string } = JSON.parse(readFileSync(manifest, 'utf8'));
        return pkg.version;
      }
      dir = dirname(dir);
    }
  } catch {
    // fall through
  }
  return 'unknown';
}

const OUT_DIR = fileURLToPath(new URL('./mcp-perf-baselines/', import.meta.url));

function writeBaseline(timestamp: string, result: Record<string, unknown>) {
  mkdirSync(OUT_DIR, { recursive: true });
  const file = `${OUT_DIR}${timestamp.replace(/[:.]/g, '-')}.json`;
  writeFileSync(file, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`\nbaseline saved: ${file}`);
}

function createApp() {
  const app = new Hono<McpHonoEnv>();
  app.use('*', async (c, next) => {
    c.set('auth', auth);
    await next();
  });
  app.all('*', handleMcpRequest);
  return app;
}

type ResponseObserver = (method: string, bytes: number) => void;

async function createClient(app: Hono<McpHonoEnv>, onResponse?: ResponseObserver) {
  const transport = new StreamableHTTPClientTransport(new URL('http://localhost/api/mcp'), {
    fetch: async (input, init) => {
      const request = new Request(input, init);
      const headers = new Headers(init?.headers);
      headers.set('authorization', 'Bearer bench-token');
      const response = await app.fetch(new Request(input, { ...init, headers }));
      if (onResponse) {
        // Buffer the body to measure its wire size, then re-serve it to the
        // client SDK. Synchronous, so the size is available immediately after
        // the caller's await resolves.
        const method = /"method"\s*:\s*"([^"]+)"/.exec((await request.text()) ?? '')?.[1];
        const text = await response.text();
        onResponse(method ?? 'unknown', Buffer.byteLength(text));
        return new Response(text, { status: response.status, headers: response.headers });
      }
      return response;
    },
  });
  const client = new Client({ name: 'bench-client', version: '1.0.0' });
  await client.connect(transport);
  return client;
}

async function main() {
  const timestamp = new Date().toISOString();
  await ensureMcpToolsRegistered();

  const app = createApp();

  // Capture the wire size of the real tools/list exchange (for the cache-hint
  // optimization): the response bodies that flow through the transport.
  const responseBytes: Map<string, number> = new Map();
  const client = await createClient(app, (method, bytes) => {
    responseBytes.set(method, (responseBytes.get(method) ?? 0) + bytes);
  });
  await client.listTools();
  const listWireBytes = responseBytes.get('tools/list') ?? 0;

  console.log('MCP server perf baseline (in-process, no auth/rate-limit middleware)\n');
  console.log(`registered tools: ${listToolsForScopes(MCP_SCOPES).length}`);
  console.log(
    `tools/list wire bytes: ${listWireBytes} (${(listWireBytes / 1024).toFixed(1)} KiB)\n`,
  );

  const toolSamples: Sample = [];
  const promptSamples: Sample = [];
  const callSamples: Sample = [];

  // Warmup (JIT).
  for (let i = 0; i < WARMUP; i += 1) {
    await client.listTools();
    await client.listPrompts();
  }
  try {
    await client.callTool({ name: 'career_profile', arguments: {} });
  } catch {
    // career_profile needs the DB; ignore a warmup failure.
  }

  console.log('end-to-end (client SDK, per-request McpServer rebuild):');
  for (let i = 0; i < ITERATIONS; i += 1) {
    await time(() => client.listTools(), toolSamples);
    await time(() => client.listPrompts(), promptSamples);
  }
  summarize('tools/list', toolSamples);
  summarize('prompts/list', promptSamples);

  // DB-backed tool call (career_profile for a nonexistent user returns null).
  let callStats: MetricStats | null = null;
  try {
    for (let i = 0; i < ITERATIONS; i += 1) {
      await time(() => client.callTool({ name: 'career_profile', arguments: {} }), callSamples);
    }
    summarize('tools/call career_profile', callSamples);
    callStats = stats(callSamples);
  } catch (error) {
    console.log(
      `tools/call career_profile: skipped (${error instanceof Error ? error.message : error})`,
    );
  }

  // Direct breakdown of the factory's inner loop (no McpServer serialization):
  // listToolsForScopes + describeCapability are the exported pieces of
  // createMcpServer. Timing them shows how much of the per-request cost is
  // left to `new McpServer()` + `registerTool` zod->JSON-Schema serialization.
  console.log('\nfactory internals (raw, no McpServer schema serialization):');
  const definitions = listToolsForScopes(MCP_SCOPES);
  const describeOnlySamples: Sample = [];
  for (let i = 0; i < ITERATIONS; i += 1) {
    await time(async () => {
      for (const definition of definitions) describeCapability(definition);
    }, describeOnlySamples);
  }
  summarize('describeCapability (all tools)', describeOnlySamples);

  const listOnlySamples: Sample = [];
  for (let i = 0; i < ITERATIONS; i += 1) {
    await time(async () => listToolsForScopes(MCP_SCOPES), listOnlySamples);
  }
  summarize('listToolsForScopes', listOnlySamples);

  await client.close();

  const result = {
    timestamp,
    meta: {
      node: process.version,
      mcpServer: pkgVersion('@modelcontextprotocol/server'),
      mcpClient: pkgVersion('@modelcontextprotocol/client'),
      toolCount: listToolsForScopes(MCP_SCOPES).length,
      iterations: ITERATIONS,
      warmup: WARMUP,
      mode: 'stateless + json responseMode (createMcpHandler)',
      harness: 'in-process, no auth/rate-limit middleware, fake auth context',
    },
    git: { sha: gitSha() },
    toolsListWireBytes: listWireBytes,
    metrics: {
      toolsList: stats(toolSamples),
      promptsList: stats(promptSamples),
      toolsCallCareerProfile: callStats,
      describeCapabilityAllTools: stats(describeOnlySamples),
      listToolsForScopes: stats(listOnlySamples),
    },
  };

  writeBaseline(result.timestamp, result);
  process.exit(0);
}

await main();
