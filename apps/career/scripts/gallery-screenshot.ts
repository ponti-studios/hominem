import 'dotenv/config';
import { access, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { chromium } from 'playwright';

/**
 * Captures gallery-ready screenshots of the Craftd app:
 *
 *   pnpm --filter @hominem/career gallery:screenshot --preset demo
 *   pnpm --filter @hominem/career gallery:screenshot --preset dashboard
 *   pnpm --filter @hominem/career gallery:screenshot --preset pipeline
 *
 * `demo` is the public "Sarah Chen" sample portfolio at /demo — no login
 * needed. `dashboard` and `pipeline` are real authenticated app screens
 * (/applications, and an application's detail/timeline view) and require a
 * saved session — run `pnpm --filter @hominem/career gallery:login` once
 * first, which opens a real browser for you to log into by hand and saves
 * the session to apps/career/.auth/storage-state.json (gitignored).
 *
 * Writes into the labs repo's project-gallery folder by default, since
 * that's what app/data/projects.ts in the labs repo references; override
 * with --out-dir for a different target.
 */

const DEFAULT_BASE_URL = 'http://localhost:4451';
const DEFAULT_OUT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../labs/apps/labyrinth/public/screenshots',
);
const DEFAULT_STORAGE_STATE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../.auth/storage-state.json',
);

type PresetName = 'demo' | 'dashboard' | 'pipeline';

interface Preset {
  path: string;
  outFile: string;
  requiresAuth: boolean;
  // For "pipeline": land on the applications list, then click into the
  // first real application to land on its detail/timeline view.
  clickFirstApplication?: boolean;
}

const PRESETS: Record<PresetName, Preset> = {
  demo: { path: '/demo', outFile: 'career-craftd-demo-portfolio.png', requiresAuth: false },
  dashboard: { path: '/applications', outFile: 'career-dashboard.png', requiresAuth: true },
  pipeline: {
    path: '/applications',
    outFile: 'career-pipeline.png',
    requiresAuth: true,
    clickFirstApplication: true,
  },
};

interface Options {
  preset: PresetName;
  baseUrl: string;
  outDir: string;
  storageState: string | undefined;
  headless: boolean;
}

function parseOptions(): Options {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      preset: { type: 'string' },
      'base-url': { type: 'string' },
      'out-dir': { type: 'string' },
      'storage-state': { type: 'string' },
      headed: { type: 'boolean', default: false },
    },
    strict: true,
  });

  const preset = values.preset && values.preset in PRESETS ? (values.preset as PresetName) : 'demo';
  return {
    preset,
    baseUrl: values['base-url'] ?? DEFAULT_BASE_URL,
    outDir: values['out-dir'] ? path.resolve(values['out-dir']) : DEFAULT_OUT_DIR,
    storageState: values['storage-state']
      ? path.resolve(values['storage-state'])
      : DEFAULT_STORAGE_STATE,
    headless: !values.headed,
  };
}

async function fileExists(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const opts = parseOptions();
  const preset = PRESETS[opts.preset];
  await mkdir(opts.outDir, { recursive: true });

  const storageStatePath =
    opts.storageState && (await fileExists(opts.storageState)) ? opts.storageState : undefined;
  if (preset.requiresAuth && !storageStatePath) {
    throw new Error(
      `Preset "${opts.preset}" needs a logged-in session. Run "pnpm --filter @hominem/career gallery:login" first.`,
    );
  }

  const browser = await chromium.launch({ headless: opts.headless });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    storageState: storageStatePath,
  });
  const page = await context.newPage();

  await page.goto(`${opts.baseUrl}${preset.path}`, { waitUntil: 'networkidle' });

  if (preset.clickFirstApplication) {
    const firstRow = page.locator('a[href^="/applications/"]').first();
    await firstRow.waitFor({ state: 'visible', timeout: 10000 });
    await firstRow.click();
    await page.waitForLoadState('networkidle');
  }

  await page.waitForTimeout(500);

  const outFile = path.join(opts.outDir, preset.outFile);
  await page.screenshot({ path: outFile });
  console.log(`Saved screenshot: ${outFile}`);

  await browser.close();
}

await main();
