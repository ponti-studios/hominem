import './env';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';

import { evaluate } from 'promptfoo';

import { judgeModel, targetModel } from '../evals/lib/golden';
import type { Suite } from '../evals/lib/suite';
import { compareToBaseline, type Comparison } from './compare';
import { discoverSuites } from './discover';
import { summarize, toCases, type RawResult } from './normalize';
import { renderReport } from './report';
import type { RunManifest, SuiteRecord } from './types';

const oriRoot = new URL('../', import.meta.url).pathname;
const runsDir = `${oriRoot}runs`;
const baselinesDir = `${oriRoot}baselines`;

// Eval runs stay private and local: no telemetry, no update checks, no result sharing.
process.env.PROMPTFOO_DISABLE_TELEMETRY = '1';
process.env.PROMPTFOO_DISABLE_UPDATE = '1';
process.env.PROMPTFOO_DISABLE_SHARING = '1';
process.env.PROMPTFOO_CONFIG_DIR ??= `${runsDir}/.promptfoo`;

const usage = `ori evals

  pnpm --filter @hominem/ori eval <command> [options]

Commands
  list                     suites, tiers, case counts, dataset/prompt hashes (offline)
  check                    validate every suite and baseline without calling a model (CI)
  run                      run suites against the live model and gate against baselines
  baseline                 promote the latest full run to the committed baselines
  calibrate                score the judge against human-labeled cases

Options for run
  --suite <name>           run one suite (repeatable)
  --tier <tier>            regression | capability | holdout (repeatable)
  --trials <n>             repeat each case n times for pass^k (default 1)
  --limit <n>              first n cases per suite, a smoke run (never gates, never baselined)
  --concurrency <n>        parallel model calls (default 4)
  --cache                  reuse cached model responses (off by default: runs are measurements)
  --no-gate                report only; always exit 0 unless a run errored
`;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    suite: { type: 'string', multiple: true },
    tier: { type: 'string', multiple: true },
    trials: { type: 'string' },
    limit: { type: 'string' },
    concurrency: { type: 'string' },
    cache: { type: 'boolean' },
    'no-gate': { type: 'boolean' },
    help: { type: 'boolean', short: 'h' },
  },
});

const promptfooVersion = (): string => {
  const manifestPath = `${oriRoot}node_modules/promptfoo/package.json`;
  return (JSON.parse(readFileSync(manifestPath, 'utf8')) as { version: string }).version;
};

const gitSha = (): string => {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
};

const positive = (raw: string | undefined, fallback: number, flag: string): number => {
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1)
    throw new Error(`${flag} must be a positive integer`);
  return parsed;
};

const select = (suites: Suite[]): Suite[] => {
  const names = values.suite ?? [];
  const tiers = values.tier ?? [];
  for (const name of names) {
    if (!suites.some((suite) => suite.name === name)) {
      throw new Error(`Unknown suite "${name}". Try: ${suites.map((s) => s.name).join(', ')}`);
    }
  }
  const selected = suites.filter(
    (suite) =>
      (names.length === 0 || names.includes(suite.name)) &&
      (tiers.length === 0 || tiers.includes(suite.tier)),
  );
  if (selected.length === 0) throw new Error('No suites matched --suite/--tier');
  return selected;
};

const loadBaseline = async (name: string): Promise<SuiteRecord | undefined> => {
  const file = `${baselinesDir}/${name}.json`;
  return existsSync(file) ? (JSON.parse(await readFile(file, 'utf8')) as SuiteRecord) : undefined;
};

const testsOf = (suite: Suite) => suite.config.tests as Array<{ description?: string }>;

async function list(): Promise<void> {
  for (const suite of await discoverSuites()) {
    console.log(
      `${suite.name.padEnd(34)} ${suite.tier.padEnd(11)} ${String(testsOf(suite).length).padStart(3)} cases  data=${(suite.config.metadata as { datasetHash: string }).datasetHash} prompt=${(suite.config.metadata as { promptHash: string }).promptHash}`,
    );
  }
}

async function check(): Promise<void> {
  const suites = await discoverSuites();
  const problems: string[] = [];
  for (const suite of suites) {
    const tests = testsOf(suite);
    if (tests.length === 0) problems.push(`${suite.name}: no cases`);
    const ids = tests.map((test) => test.description);
    const duplicate = ids.find((id, index) => ids.indexOf(id) !== index);
    if (duplicate) problems.push(`${suite.name}: duplicate case id "${duplicate}"`);
    const baseline = await loadBaseline(suite.name);
    if (!baseline) {
      problems.push(
        `${suite.name}: no committed baseline (run \`eval run\` then \`eval baseline\`)`,
      );
      continue;
    }
    const metadata = suite.config.metadata as {
      datasetHash: string;
      promptHash: string;
      graderHash: string;
    };
    if (baseline.datasetHash !== metadata.datasetHash) {
      problems.push(`${suite.name}: dataset changed since the baseline was recorded`);
    }
    if (baseline.promptHash !== metadata.promptHash) {
      problems.push(`${suite.name}: prompt changed since the baseline was recorded`);
    }
    if (baseline.graderHash !== metadata.graderHash) {
      problems.push(`${suite.name}: grading logic changed since the baseline was recorded`);
    }
    const unknown = baseline.cases.filter((entry) => !ids.includes(entry.id));
    if (unknown.length > 0) {
      problems.push(
        `${suite.name}: baseline has cases not in the dataset: ${unknown.map((c) => c.id).join(', ')}`,
      );
    }
  }
  console.log(
    `${suites.length} suites, ${suites.reduce((n, s) => n + testsOf(s).length, 0)} cases checked`,
  );
  if (problems.length > 0) {
    console.error(`\n${problems.map((problem) => `  x ${problem}`).join('\n')}`);
    console.error(
      '\nStale baselines mean results are no longer comparable. Re-run and `eval baseline`.',
    );
    process.exitCode = 1;
  } else {
    console.log('all suites valid, baselines match datasets and prompts');
  }
}

async function runSuite(
  suite: Suite,
  options: { trials: number; limit?: number; concurrency: number; cache: boolean },
): Promise<SuiteRecord> {
  const tests = options.limit ? testsOf(suite).slice(0, options.limit) : testsOf(suite);
  const evalRecord = await evaluate({ ...suite.config, tests } as Parameters<typeof evaluate>[0], {
    maxConcurrency: options.concurrency,
    repeat: options.trials,
    cache: options.cache,
    showProgressBar: false,
  });
  const rows = (await evalRecord.getResults()) as unknown as RawResult[];
  const cases = toCases(
    rows,
    tests.map((test) => test.description ?? 'unnamed'),
  );
  const metadata = suite.config.metadata as {
    datasetHash: string;
    promptHash: string;
    graderHash: string;
  };
  return {
    suite: suite.name,
    tier: suite.tier,
    datasetHash: metadata.datasetHash,
    promptHash: metadata.promptHash,
    graderHash: metadata.graderHash,
    targetModel: suite.model ?? targetModel,
    judgeModel,
    trialsPerCase: options.trials,
    limited: Boolean(options.limit),
    summary: summarize(cases),
    cases,
  };
}

async function run(): Promise<void> {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is required for live runs (offline: `eval check`)');
  }
  const suites = select(await discoverSuites());
  const options = {
    trials: positive(values.trials, 1, '--trials'),
    limit: values.limit ? positive(values.limit, 1, '--limit') : undefined,
    concurrency: positive(values.concurrency, 4, '--concurrency'),
    cache: Boolean(values.cache),
  };
  const startedAt = new Date();
  const records: SuiteRecord[] = [];
  const comparisons: Comparison[] = [];
  for (const suite of suites) {
    console.log(`> ${suite.name} (${suite.tier}, ${testsOf(suite).length} cases)`);
    const record = await runSuite(suite, options);
    records.push(record);
    comparisons.push(compareToBaseline(record, await loadBaseline(suite.name)));
  }

  const manifest: RunManifest = {
    runId: startedAt.toISOString().replace(/[:.]/g, '-'),
    startedAt: startedAt.toISOString(),
    gitSha: gitSha(),
    promptfooVersion: promptfooVersion(),
    node: process.version,
    suites: records,
  };
  await mkdir(`${runsDir}/${manifest.runId}`, { recursive: true });
  const report = renderReport(manifest, comparisons);
  await writeFile(
    `${runsDir}/${manifest.runId}/results.json`,
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  await writeFile(`${runsDir}/${manifest.runId}/report.md`, report);
  await writeFile(`${runsDir}/latest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`\n${report}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    await writeFile(process.env.GITHUB_STEP_SUMMARY, report, { flag: 'a' });
  }
  console.log(`results: runs/${manifest.runId}/results.json`);

  const errored = records.some((record) => record.summary.errors > 0);
  if (errored) {
    console.error('Some trials hit provider/infrastructure errors. Results are incomplete.');
    process.exitCode = 2;
  } else if (!values['no-gate'] && comparisons.some((comparison) => comparison.gate === 'fail')) {
    process.exitCode = 1;
  }
}

async function baseline(): Promise<void> {
  const file = `${runsDir}/latest.json`;
  if (!existsSync(file)) throw new Error('No runs/latest.json. Run `eval run` first.');
  const manifest = JSON.parse(await readFile(file, 'utf8')) as RunManifest;
  await mkdir(baselinesDir, { recursive: true });
  for (const record of manifest.suites) {
    if (record.limited) {
      console.log(`skip ${record.suite}: partial run (--limit)`);
      continue;
    }
    if (record.summary.errors > 0) {
      console.log(`skip ${record.suite}: ${record.summary.errors} errored trial(s)`);
      continue;
    }
    // Trim per-trial noise (reasons, tokens) so baseline diffs stay readable in review.
    const slim: SuiteRecord = {
      ...record,
      cases: record.cases.map((entry) => ({
        ...entry,
        trials: entry.trials.map(
          ({ pass, score, failedMetrics, latencyMs, costUsd, promptTokens, completionTokens }) => ({
            pass,
            score,
            failedMetrics,
            latencyMs,
            costUsd,
            promptTokens,
            completionTokens,
          }),
        ),
      })),
    };
    await writeFile(`${baselinesDir}/${record.suite}.json`, `${JSON.stringify(slim, null, 2)}\n`);
    console.log(`baseline ${record.suite}: pass rate ${record.summary.passRate}`);
  }
}

async function main(): Promise<void> {
  const command = positionals[0];
  if (values.help || !command) return void console.log(usage);
  switch (command) {
    case 'list':
      return list();
    case 'check':
      return check();
    case 'run':
      return run();
    case 'baseline':
      return baseline();
    case 'calibrate':
      return (await import('./calibrate')).calibrate();
    default:
      throw new Error(`Unknown command "${command}"\n\n${usage}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 2;
});
