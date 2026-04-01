import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import process from 'node:process';

function formatDuration(ms) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`;
}

function main() {
  const reportPath = process.argv[2];
  const heading = process.argv[3] ?? '### Slowest tests';
  const limit = process.argv[4] ? Number.parseInt(process.argv[4], 10) : 5;
  const warnThreshold = process.argv[5] ? Number.parseInt(process.argv[5], 10) : null;
  const failThreshold = process.argv[6] ? Number.parseInt(process.argv[6], 10) : null;

  if (!reportPath) throw new Error('Expected report path as the first argument');

  const report = JSON.parse(readFileSync(reportPath, 'utf8'));

  // Single pass: collect all tests, sorted by duration descending
  const all = (report.testResults ?? [])
    .flatMap((suite) =>
      (suite.assertionResults ?? []).map((a) => ({
        duration: a.duration ?? 0,
        fullName: a.fullName,
        file: suite.name,
        status: a.status,
      })),
    )
    .filter((t) => t.status === 'passed' || t.status === 'failed')
    .sort((a, b) => b.duration - a.duration);

  console.log(heading);
  console.log('');

  if (all.length === 0) {
    console.log('- No test timing data found');
    return;
  }

  for (const t of all.slice(0, limit)) {
    console.log(`- ${formatDuration(t.duration)} | ${t.fullName} | ${basename(t.file)}`);
  }

  if (warnThreshold !== null) {
    const breaches = all.filter((t) => t.duration >= warnThreshold);
    console.log('');
    console.log(`### Threshold breaches (>= ${formatDuration(warnThreshold)})`);
    console.log('');
    if (breaches.length === 0) {
      console.log('- No tests exceeded the warning threshold');
    } else {
      for (const t of breaches) {
        console.log(`- ${formatDuration(t.duration)} | ${t.fullName} | ${basename(t.file)}`);
      }
    }
  }

  if (failThreshold !== null && all.some((t) => t.duration >= failThreshold)) {
    process.exitCode = 1;
  }
}

main();
