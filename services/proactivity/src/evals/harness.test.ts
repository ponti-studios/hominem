import { describe, expect, it } from 'vitest';

import { proactivityEvalCases, type ProactivityEvalCase } from './cases.js';
import {
  createExpectedSlot,
  runProactivityEvalCase,
  runProactivityEvalSuite,
  selectEvalCases,
  type ProactivitySlot,
} from './harness.js';

function caseById(id: string): ProactivityEvalCase {
  const input = proactivityEvalCases.find((candidate) => candidate.id === id);
  if (!input) throw new Error(`Missing eval case ${id}`);
  return input;
}

describe('proactivity eval suite', () => {
  it('passes every case with the expected slot', async () => {
    const results = await runProactivityEvalSuite(
      proactivityEvalCases,
      createExpectedSlot(proactivityEvalCases),
    );

    expect(results).toHaveLength(proactivityEvalCases.length);
    expect(results.filter(({ passed }) => !passed)).toEqual([]);
  });

  it('reports a wrong decision kind', async () => {
    const slot: ProactivitySlot = {
      evaluate: async () => ({ kind: 'quiet', reason: 'Nothing changed.', evidenceIds: [] }),
    };

    const result = await runProactivityEvalCase(caseById('grocery-overspend'), slot);

    expect(result.passed).toBe(false);
    expect(result.failures).toContain('Expected "propose", got "quiet".');
  });

  it('reports a decision that does not cite the required evidence', async () => {
    const slot: ProactivitySlot = {
      evaluate: async () => ({
        kind: 'propose',
        summary: 'Groceries are over budget',
        reason: 'Spending is above the limit.',
        nextStep: 'Review the budget.',
        evidenceIds: ['ev-groceries-oct'],
      }),
    };

    const result = await runProactivityEvalCase(caseById('grocery-overspend'), slot);

    expect(result.passed).toBe(false);
    expect(result.failures).toContain(
      'Decision did not cite required evidence "ev-groceries-nov".',
    );
  });

  it('reports forbidden language in a decision', async () => {
    const slot: ProactivitySlot = {
      evaluate: async () => ({
        kind: 'propose',
        summary: 'We guarantee you must cut spending',
        reason: 'Spending is above the limit.',
        nextStep: 'Review the budget.',
        evidenceIds: ['ev-groceries-nov'],
      }),
    };

    const result = await runProactivityEvalCase(caseById('grocery-overspend'), slot);

    expect(result.passed).toBe(false);
    expect(result.failures).toEqual(
      expect.arrayContaining([
        'Decision repeated forbidden term "guarantee".',
        'Decision repeated forbidden term "you must".',
      ]),
    );
  });

  it('reports delivery for a quiet decision', async () => {
    const slot: ProactivitySlot = {
      evaluate: async () => ({
        kind: 'propose',
        summary: 'Debt is shrinking',
        reason: 'The balance fell.',
        nextStep: 'Keep going.',
        evidenceIds: ['ev-debt-nov'],
      }),
    };

    const result = await runProactivityEvalCase(caseById('debt-paydown-progress'), slot);

    expect(result.passed).toBe(false);
    expect(result.failures).toContain('Expected "quiet", got "propose".');
    expect(result.failures).toContain('A "quiet" case must not deliver a goal proposal.');
  });

  it('runs no evaluation when the change is outside the goal domain', async () => {
    const result = await runProactivityEvalCase(
      caseById('unrelated-domain'),
      createExpectedSlot(proactivityEvalCases),
    );

    expect(result.passed).toBe(true);
    expect(result.actual).toBe('none');
    expect(result.deliveryIntents).toEqual([]);
  });

  it('partitions every case into exactly one split', () => {
    const regression = selectEvalCases(proactivityEvalCases, 'regression');
    const holdout = selectEvalCases(proactivityEvalCases, 'holdout');
    const ids = [...regression, ...holdout].map(({ id }) => id);

    expect(selectEvalCases(proactivityEvalCases, 'all')).toHaveLength(proactivityEvalCases.length);
    expect(new Set(ids).size).toBe(proactivityEvalCases.length);
    expect(regression.length + holdout.length).toBe(proactivityEvalCases.length);
    expect(regression.length).toBeGreaterThan(0);
    expect(holdout.length).toBeGreaterThan(0);
  });

  it('records the goal, trigger, and snapshot identifiers on every result', async () => {
    const result = await runProactivityEvalCase(
      caseById('grocery-overspend'),
      createExpectedSlot(proactivityEvalCases),
    );

    expect(result).toMatchObject({
      caseId: 'grocery-overspend',
      split: 'regression',
      goalId: 'eval-groceries',
      triggerKind: 'critical-change',
      previousSnapshotId: 'groceries-oct',
      currentSnapshotId: 'groceries-nov',
    });
    expect(result.decision?.evidenceIds).toContain('ev-groceries-nov');
  });

  it('skips a paused goal', async () => {
    const result = await runProactivityEvalCase(
      caseById('paused-goal-critical-change'),
      createExpectedSlot(proactivityEvalCases),
    );

    expect(result.passed).toBe(true);
    expect(result.actual).toBe('none');
    expect(result.split).toBe('holdout');
  });

  it('reuses the journaled evaluation when the same trigger is replayed', async () => {
    let evaluateCalls = 0;
    const slot: ProactivitySlot = {
      evaluate: async () => {
        evaluateCalls += 1;
        return {
          kind: 'propose',
          summary: 'Groceries are over budget',
          reason: 'Spending is above the monthly limit.',
          nextStep: 'Review the budget.',
          evidenceIds: ['ev-groceries-repeat-nov'],
        };
      },
    };

    const result = await runProactivityEvalCase(caseById('repeat-handled-change'), slot);

    expect(evaluateCalls).toBe(1);
    expect(result.passed).toBe(true);
    expect(result.deliveryIntents).toHaveLength(1);
  });
});
