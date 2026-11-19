import { describe, expect, it } from 'vitest';

import { ledgerColumns, ledgerRows, renderLedger } from './ledger';
import type { RunManifest } from './types';

const manifest = {
  runId: '2026-01-01T00-00-00-000Z',
  gitSha: 'abc123',
  suites: [
    {
      suite: 'demo',
      promptHash: 'p123',
      tier: 'capability',
      trialsPerCase: 3,
      limited: false,
      targetModel: 'a/b',
      judgeModel: 'c,d',
      summary: {
        cases: 2,
        passRate: 0.5,
        passAllRate: 0.5,
        errors: 0,
        costUsd: 0.01,
        promptTokens: 10,
        completionTokens: 2,
        latencyP50Ms: 5,
        latencyP95Ms: 9,
      },
    },
  ],
} as unknown as RunManifest;

describe('ledger', () => {
  it('writes a header plus one row per suite, in column order', () => {
    const lines = renderLedger(ledgerRows(manifest)).trim().split('\n');
    expect(lines[0]).toBe(ledgerColumns.join(','));
    expect(lines).toHaveLength(2);
    expect(
      lines[1]?.startsWith('2026-01-01T00-00-00-000Z,abc123,p123,demo,capability,2,3,false,0.5'),
    ).toBe(true);
  });

  it('quotes cells that contain commas', () => {
    expect(renderLedger(ledgerRows(manifest))).toContain('"c,d"');
  });
});
