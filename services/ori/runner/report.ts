import type { Comparison } from './compare';
import type { RunManifest } from './types';

const pct = (value: number): string => `${(value * 100).toFixed(0)}%`;
const usd = (value: number): string => `$${value.toFixed(4)}`;

/** Markdown report: one table for the run, then detail for anything that needs eyes. */
export function renderReport(manifest: RunManifest, comparisons: readonly Comparison[]): string {
  const lines = [
    `## ori evals · ${manifest.runId}`,
    '',
    `git \`${manifest.gitSha}\` · promptfoo ${manifest.promptfooVersion} · ${manifest.node}`,
    '',
    '| suite | tier | cases×trials | pass | pass^k | errors | p50 | p95 | cost | vs baseline |',
    '|---|---|---|---|---|---|---|---|---|---|',
  ];
  for (const record of manifest.suites) {
    const s = record.summary;
    const comparison = comparisons.find((entry) => entry.suite === record.suite);
    const versus = !comparison
      ? ''
      : comparison.comparable
        ? `${comparison.gate === 'fail' ? 'FAIL' : 'ok'} (${(comparison.passRateDelta ?? 0) >= 0 ? '+' : ''}${((comparison.passRateDelta ?? 0) * 100).toFixed(0)}pt)`
        : `n/a: ${comparison.note}`;
    lines.push(
      `| ${record.suite} | ${record.tier} | ${s.cases}×${record.trialsPerCase} | ${pct(s.passRate)} | ${pct(s.passAllRate)} | ${s.errors} | ${s.latencyP50Ms}ms | ${s.latencyP95Ms}ms | ${usd(s.costUsd)} | ${versus} |`,
    );
  }
  const total = manifest.suites.reduce((sum, record) => sum + record.summary.costUsd, 0);
  lines.push(
    '',
    `Total cost ${usd(total)} · target \`${manifest.suites[0]?.targetModel}\` · judge \`${manifest.suites[0]?.judgeModel}\``,
  );

  for (const comparison of comparisons) {
    if (comparison.regressions.length > 0) {
      lines.push(
        '',
        `**Regressions in ${comparison.suite}**: ${comparison.regressions.join(', ')}`,
      );
    }
    if (comparison.fixes.length > 0) {
      lines.push('', `Fixed in ${comparison.suite}: ${comparison.fixes.join(', ')}`);
    }
  }
  for (const record of manifest.suites) {
    const failing = record.cases.filter((entry) => !entry.passAll && !entry.errored);
    if (failing.length === 0) continue;
    lines.push(
      '',
      `<details><summary>${record.suite}: ${failing.length} failing case(s)</summary>`,
      '',
    );
    for (const entry of failing) {
      const trial = entry.trials.find((candidate) => !candidate.pass);
      lines.push(
        `- \`${entry.id}\` [${trial?.failedMetrics.join(', ')}] ${trial?.reason?.replace(/\s+/g, ' ').slice(0, 240) ?? ''}`,
      );
    }
    lines.push('', '</details>');
  }
  return `${lines.join('\n')}\n`;
}
