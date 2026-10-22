import { mkdir, readFile, writeFile } from 'node:fs/promises';

import { assertions } from 'promptfoo';

import { judgeModel } from '../evals/lib/golden';
import { discoverSuites } from './discover';

type LabeledCase = {
  id: string;
  suite: string;
  reference: string;
  candidate: string;
  label: 'pass' | 'fail';
};

/** Minimum share of labels the judge must reproduce before we trust its pass rates. */
const MIN_AGREEMENT = 0.85;

const labelsUrl = new URL('../calibration/judge-labels.json', import.meta.url);

/**
 * Scores the judge, not the model. Each labeled candidate is graded with the real suite
 * rubric; disagreements with the human label are the judge's error rate. Run it whenever
 * the judge model, the rubric wording, or the judging provider changes.
 */
export async function calibrate(): Promise<void> {
  if (process.env.ORI_ENV_FILE) process.loadEnvFile(process.env.ORI_ENV_FILE);
  if (!process.env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY is required');
  const { cases } = JSON.parse(await readFile(labelsUrl, 'utf8')) as { cases: LabeledCase[] };
  const suites = await discoverSuites();

  const rows: Array<{ id: string; label: string; verdict: string; score: number; reason: string }> =
    [];
  for (const labeled of cases) {
    const suite = suites.find((candidate) => candidate.name === labeled.suite);
    const tests = suite?.config.tests as Array<{
      assert?: Array<{ type: string; value?: unknown }>;
    }>;
    const rubric = tests?.[0]?.assert?.find((assertion) => assertion.type === 'llm-rubric')?.value;
    if (typeof rubric !== 'string') throw new Error(`Suite "${labeled.suite}" has no llm-rubric`);
    const grade = await assertions.matchesLlmRubric(
      rubric.replace('{{expectedOutput}}', labeled.reference),
      labeled.candidate,
      { provider: `openrouter:${judgeModel}` },
    );
    rows.push({
      id: labeled.id,
      label: labeled.label,
      verdict: grade.score >= 0.7 ? 'pass' : 'fail',
      score: grade.score,
      reason: grade.reason,
    });
  }

  const wrong = rows.filter((row) => row.label !== row.verdict);
  const falsePass = wrong.filter((row) => row.verdict === 'pass').length;
  const falseFail = wrong.filter((row) => row.verdict === 'fail').length;
  const agreement = (rows.length - wrong.length) / rows.length;

  console.log(
    `judge ${judgeModel}: agreement ${(agreement * 100).toFixed(0)}% on ${rows.length} labeled cases`,
  );
  console.log(
    `false passes (judge too lenient): ${falsePass} · false fails (too strict): ${falseFail}`,
  );
  for (const row of wrong) {
    console.log(
      `  disagree ${row.id}: human=${row.label} judge=${row.verdict} (${row.score}) ${row.reason.slice(0, 160)}`,
    );
  }
  await mkdir(new URL('../runs/', import.meta.url), { recursive: true });
  await writeFile(
    new URL('../runs/judge-calibration.json', import.meta.url),
    `${JSON.stringify({ judgeModel, agreement, falsePass, falseFail, rows }, null, 2)}\n`,
  );
  if (agreement < MIN_AGREEMENT || falsePass > 0) {
    console.error(`Judge below bar (need agreement >= ${MIN_AGREEMENT} and zero false passes).`);
    process.exitCode = 1;
  }
}
