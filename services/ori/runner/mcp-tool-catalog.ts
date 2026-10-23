import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

import { z } from 'zod';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const snapshotPath = fileURLToPath(
  new URL('../evals/lib/mcp-tool-catalog.generated.json', import.meta.url),
);
const exporterArgs = (outputPath: string) => [
  '--silent',
  '--filter',
  '@hominem/api',
  'exec',
  'tsx',
  '--tsconfig',
  'tsconfig.dev.json',
  'scripts/export-mcp-eval-tool-catalog.ts',
  '--output',
  outputPath,
];

function readSnapshot(): unknown {
  try {
    return JSON.parse(readFileSync(snapshotPath, 'utf8'));
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return undefined;
    }
    throw error;
  }
}

const tempDir = mkdtempSync(join(tmpdir(), 'hominem-mcp-catalog-'));
const tempCatalogPath = join(tempDir, 'catalog.json');
try {
  execFileSync('pnpm', exporterArgs(tempCatalogPath), {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      CI: '1',
      DOTENV_CONFIG_PATH: '/dev/null',
    },
    maxBuffer: 1024 * 1024,
  });
  const parsed: unknown = JSON.parse(readFileSync(tempCatalogPath, 'utf8'));
  const toolSchema = z
    .object({
      type: z.literal('function'),
      function: z.object({
        name: z.string(),
        description: z.string(),
        parameters: z
          .object({ type: z.literal('object'), properties: z.record(z.string(), z.unknown()) })
          .passthrough(),
      }),
    })
    .passthrough();
  const generatedCatalog = z.array(toolSchema).parse(parsed);
  const generated = `${JSON.stringify(generatedCatalog, null, 2)}\n`;

  const current = readSnapshot();

  if (process.argv.includes('--write')) {
    writeFileSync(snapshotPath, generated);
    process.stdout.write(`Updated ${snapshotPath}\n`);
  } else if (!isDeepStrictEqual(current, generatedCatalog)) {
    process.stderr.write(
      'The checked-in MCP eval catalog is stale. Run `pnpm --filter @hominem/ori eval:catalog:update` and review the diff.\n',
    );
    process.exitCode = 1;
  } else {
    process.stdout.write('MCP eval catalog matches the API tool registry.\n');
  }
} catch (error) {
  throw new Error('Could not generate the API MCP catalog in an isolated temporary file', {
    cause: error,
  });
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
