import { createHash } from 'node:crypto';
import {
  chmod,
  mkdir,
  rename,
  stat,
  unlink,
  writeFile,
  appendFile,
  readFile,
} from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { z } from 'zod';

import {
  rulingQueueOutputSchema,
  rulingRulebookImportInputSchema,
} from '../src/schemas/finance.rulings.schema';

const endpoint = process.env.HOMINEM_MCP_URL;
const token = process.env.HOMINEM_MCP_TOKEN;
const mode = process.env.RULINGS_MODE ?? 'prep-only';
const referenceBundlePath = process.env.RULINGS_REFERENCE_BUNDLE;
const outputDir = process.env.RULINGS_OUTPUT_DIR ?? join(homedir(), '.hominem', 'rulings');
const auditPath = join(outputDir, 'audit.jsonl');
const outputPath = join(outputDir, 'verdict-queue.json');

if (!endpoint || !token) throw new Error('Set HOMINEM_MCP_URL and HOMINEM_MCP_TOKEN.');
if (mode !== 'prep-only') throw new Error('Rulings execution is not enabled.');
const url = new URL(endpoint);
if (
  !['api.ponti.io', 'api.lvh.me', 'localhost', '127.0.0.1'].includes(url.hostname) ||
  !['https:', 'http:'].includes(url.protocol) ||
  (url.protocol === 'http:' && !['localhost', '127.0.0.1'].includes(url.hostname)) ||
  url.pathname !== '/api/mcp' ||
  url.username ||
  url.password ||
  url.search ||
  url.hash
)
  throw new Error('HOMINEM_MCP_URL must identify a Hominem MCP endpoint.');

await mkdir(outputDir, { recursive: true, mode: 0o700 });
if (((await stat(outputDir)).mode & 0o077) !== 0)
  throw new Error('Rulings output directory must be private.');
await appendFile(auditPath, '', { mode: 0o600 });
await chmod(auditPath, 0o600);
const transport = new StreamableHTTPClientTransport(url, {
  fetch: async (input, init) => {
    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
    headers.set('authorization', `Bearer ${token}`);
    try {
      const response = await fetch(input, { ...init, headers });
      await appendFile(
        auditPath,
        `${JSON.stringify({ at: new Date().toISOString(), transport: 'mcp', method: init?.method ?? 'GET', status: response.status })}\n`,
        { mode: 0o600 },
      );
      await chmod(auditPath, 0o600);
      return response;
    } catch (error) {
      await appendFile(
        auditPath,
        `${JSON.stringify({ at: new Date().toISOString(), transport: 'mcp', method: init?.method ?? 'GET', error: 'Request failed' })}\n`,
        { mode: 0o600 },
      );
      throw error;
    }
  },
});
const client = new Client({ name: 'hominem-rulings-worker', version: '0.1.0' });
await client.connect(transport);

async function readQueue() {
  const verdicts: Array<ReturnType<typeof rulingQueueOutputSchema.parse>['verdicts'][number]> = [];
  const seen = new Set<string>();
  let total: number | undefined;
  for (let offset = 0; ; offset += 50) {
    const args = { offset, limit: 50 };
    try {
      const result = await client.callTool({ name: 'finance_rulings_queue', arguments: args });
      await appendFile(
        auditPath,
        `${JSON.stringify({ at: new Date().toISOString(), tool: 'finance_rulings_queue', arguments: args, result })}\n`,
        { mode: 0o600 },
      );
      await chmod(auditPath, 0o600);
      if (result.isError) throw new Error('Queue request failed.');
      const page = rulingQueueOutputSchema.parse(result.structuredContent);
      total ??= page.total;
      if (page.total !== total) throw new Error('Queue changed while exporting; retry.');
      for (const verdict of page.verdicts) {
        if (seen.has(verdict.id)) throw new Error('Queue paging changed; retry.');
        seen.add(verdict.id);
        verdicts.push(verdict);
      }
      if (verdicts.length === total) break;
      if (page.verdicts.length === 0) throw new Error('Queue paging ended early; retry.');
    } catch (error) {
      await appendFile(
        auditPath,
        `${JSON.stringify({ at: new Date().toISOString(), tool: 'finance_rulings_queue', arguments: args, error: error instanceof Error ? error.message : 'Request failed' })}\n`,
        { mode: 0o600 },
      );
      throw error;
    }
  }
  const temporaryPath = `${outputPath}.${process.pid}.tmp`;
  try {
    await writeFile(
      temporaryPath,
      JSON.stringify({ exportedAt: new Date().toISOString(), verdicts }, null, 2),
      { mode: 0o600, flag: 'wx' },
    );
    await rename(temporaryPath, outputPath);
    await chmod(outputPath, 0o600);
  } finally {
    await unlink(temporaryPath).catch(() => {});
  }
  process.stdout.write(`Exported ${verdicts.length} verdicts.\n`);
}

async function importReferenceRulebook() {
  if (!referenceBundlePath) return;
  const source: unknown = JSON.parse(await readFile(referenceBundlePath, 'utf8'));
  const wrapped = z
    .object({ fingerprint: z.string().optional(), rulebook: z.unknown() })
    .safeParse(source);
  const bundle = wrapped.success ? wrapped.data : { rulebook: source };
  const fingerprint =
    typeof bundle.fingerprint === 'string'
      ? bundle.fingerprint
      : createHash('sha256').update(JSON.stringify(bundle.rulebook)).digest('hex');
  const input = rulingRulebookImportInputSchema.parse({ fingerprint, rulebook: bundle.rulebook });
  const result = await client.callTool({
    name: 'finance_rulings_import_reference_rulebook',
    arguments: input,
  });
  await appendFile(
    auditPath,
    `${JSON.stringify({ at: new Date().toISOString(), tool: 'finance_rulings_import_reference_rulebook', fingerprint, result: result.isError ? 'failed' : 'imported' })}\n`,
    { mode: 0o600 },
  );
  await chmod(auditPath, 0o600);
  if (result.isError) throw new Error('Reference rulebook import failed.');
}

try {
  do {
    await importReferenceRulebook();
    await readQueue();
    if (process.argv.includes('--watch')) await delay(30_000);
  } while (process.argv.includes('--watch'));
} finally {
  await client.close();
}
