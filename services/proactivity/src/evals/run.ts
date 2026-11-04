import { proactivityEvalCases } from './cases.js';
import {
  createExpectedSlot,
  runProactivityEvalSuite,
  type ProactivityEvalResult,
} from './harness.js';

const DEFAULT_LIVE_MODEL = 'openai/gpt-5-mini';

const args = process.argv.slice(2);
const live = args.includes('--live') || args.includes('--openrouter');
const json = args.includes('--json');
const list = args.includes('--list');
const caseIds = valuesFor('--case');
const model = valueFor('--model') ?? process.env.PROACTIVITY_EVAL_MODEL ?? DEFAULT_LIVE_MODEL;

if (args.includes('--help') || args.includes('-h')) {
  console.log(`Proactivity eval

  pnpm --filter @hominem/proactivity eval -- --offline
  pnpm --filter @hominem/proactivity eval -- --live [--model <id>] [--case <id>] [--json] [--list]

Default: offline (scripted evaluator, no model calls).
`);
  process.exit(0);
}

if (list) {
  for (const input of proactivityEvalCases) {
    console.log(`${input.id}\t${input.expected.decision}\t${input.category}\t${input.title}`);
  }
  process.exit(0);
}

const cases =
  caseIds.length === 0
    ? proactivityEvalCases
    : proactivityEvalCases.filter((input) => caseIds.includes(input.id));

if (cases.length === 0) {
  console.error(`No cases matched: ${caseIds.join(', ')}`);
  process.exit(2);
}

const slot = live
  ? (await import('../openrouter-slot.js')).createOpenRouterProactivitySlot({ model })
  : createExpectedSlot(cases);

console.log(
  `Proactivity eval — ${cases.length} case(s), ${live ? `live model ${model}` : 'offline expected slot'}\n`,
);

const results = await runProactivityEvalSuite(cases, slot, {
  onResult: (result) => {
    if (!json) printResult(result);
  },
});

const passed = results.filter(({ passed }) => passed).length;

if (json) {
  console.log(
    JSON.stringify(
      {
        mode: live ? 'live' : 'offline',
        model: live ? model : null,
        passed,
        failed: results.length - passed,
        results,
      },
      null,
      2,
    ),
  );
} else {
  console.log(`\n${passed}/${results.length} passed`);
}

if (passed !== results.length) process.exitCode = 1;

function printResult(result: ProactivityEvalResult) {
  const mark = result.passed ? '✓' : '✗';
  const expected =
    result.actual === result.expected ? result.actual : `${result.expected} (got ${result.actual})`;
  console.log(`${mark} ${result.caseId.padEnd(28)} ${expected.padEnd(22)} ${result.latencyMs}ms`);
  for (const failure of result.failures) console.log(`    ${failure}`);
}

function valueFor(flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function valuesFor(flag: string): string[] {
  return args.flatMap((arg, index) => (arg === flag && args[index + 1] ? [args[index + 1]] : []));
}
