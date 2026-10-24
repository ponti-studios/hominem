import { mkdir, readFile, writeFile } from 'node:fs/promises';

import { assertions } from 'promptfoo';

import { judgeModel } from '../evals/lib/golden';
import { summarizeCalibration, type CalibrationRow } from './calibration-metrics';
import { discoverSuites } from './discover';

type LabeledCase = {
  id: string;
  suite: string;
  reference: string;
  candidate: string;
  label: 'pass' | 'fail';
};

/** Minimum observed agreement and lower confidence bound for each calibration slice. */
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
  if (cases.length === 0)
    throw new Error('Judge calibration needs at least one human-labeled case');
  const suites = await discoverSuites();

  const rows: CalibrationRow[] = [];
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
      suite: labeled.suite,
      label: labeled.label,
      verdict: grade.score >= 0.7 ? 'pass' : 'fail',
      score: grade.score,
      reason: grade.reason,
    });
  }

  const bySuite = Object.fromEntries(
    [...new Set(rows.map((row) => row.suite))]
      .sort()
      .map((suite) => [suite, summarizeCalibration(rows.filter((row) => row.suite === suite))]),
  );
  const overall = summarizeCalibration(rows);

  console.log(
    `judge ${judgeModel}: agreement ${(overall.agreement * 100).toFixed(0)}% on ${overall.cases} labeled cases`,
  );
  console.log(
    `overall 95% Wilson interval ${(overall.agreementInterval95.lower * 100).toFixed(0)}–${(overall.agreementInterval95.upper * 100).toFixed(0)}% · Cohen's κ ${overall.cohenKappa ?? 'undefined'}`,
  );
  for (const [suite, stats] of Object.entries(bySuite)) {
    console.log(
      `  ${suite}: ${stats.cases} cases · agreement ${(stats.agreement * 100).toFixed(0)}% · 95% Wilson ${(stats.agreementInterval95.lower * 100).toFixed(0)}–${(stats.agreementInterval95.upper * 100).toFixed(0)}% · κ ${stats.cohenKappa ?? 'undefined'} · false passes ${stats.falsePass} · false fails ${stats.falseFail}`,
    );
  }
  for (const row of rows.filter((entry) => entry.label !== entry.verdict)) {
    console.log(
      `  disagree ${row.id} (${row.suite}): human=${row.label} judge=${row.verdict} (${row.score}) ${row.reason.slice(0, 160)}`,
    );
  }
  await mkdir(new URL('../runs/', import.meta.url), { recursive: true });
  await writeFile(
    new URL('../runs/judge-calibration.json', import.meta.url),
    `${JSON.stringify({ judgeModel, overall, bySuite, rows }, null, 2)}\n`,
  );
  const failedSuites = Object.entries(bySuite)
    .filter(
      ([, stats]) =>
        stats.agreement < MIN_AGREEMENT ||
        stats.agreementInterval95.lower < MIN_AGREEMENT ||
        stats.falsePass > 0,
    )
    .map(([suite]) => suite);
  if (failedSuites.length > 0) {
    console.error(
      `Judge calibration below bar for ${failedSuites.join(', ')}. Each suite needs observed agreement >= ${MIN_AGREEMENT}, a 95% Wilson lower bound >= ${MIN_AGREEMENT}, and zero false passes. Treat small curated samples as screening evidence, not proof of generalization.`,
    );
    process.exitCode = 1;
  }
}
