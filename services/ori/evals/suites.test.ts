import { expect, test } from 'vitest';

import { discoverSuites } from '../runner/discover';

// Offline sanity for every suite: nothing here calls a model.
const suites = await discoverSuites();

test('finds the suites', () => {
  expect(suites.length).toBeGreaterThanOrEqual(12);
});

test.each(suites.map((suite) => [suite.name, suite] as const))(
  '%s is well formed',
  (_name, suite) => {
    const tests = suite.config.tests as Array<{
      description?: string;
      assert?: unknown[];
      metadata?: Record<string, unknown>;
    }>;
    expect(tests.length).toBeGreaterThan(0);
    const ids = tests.map((entry) => entry.description);
    expect(new Set(ids).size, 'case ids must be unique').toEqual(ids.length);
    for (const entry of tests) {
      expect(entry.description, 'every case needs a stable id').toBeTruthy();
      expect(entry.assert?.length, `${entry.description} needs assertions`).toBeGreaterThan(0);
      expect(entry.metadata?.tier).toEqual(suite.tier);
    }
    const metadata = suite.config.metadata as { datasetHash: string; promptHash: string };
    expect(metadata.datasetHash).toMatch(/^[0-9a-f]{12}$/);
  },
);

test('judge assertions always follow deterministic ones', () => {
  for (const suite of suites) {
    for (const entry of suite.config.tests as Array<{
      assert?: Array<{ type: string; metric?: string }>;
    }>) {
      const kinds = (entry.assert ?? []).map((a) =>
        a.type === 'llm-rubric' || a.metric === 'judge' ? 'judge' : 'det',
      );
      const firstJudge = kinds.indexOf('judge');
      if (firstJudge >= 0) expect(kinds.slice(firstJudge)).not.toContain('det');
    }
  }
});
