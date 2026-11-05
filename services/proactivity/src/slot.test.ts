import { describe, expect, it, vi } from 'vitest';

import {
  buildProactivityPrompt,
  createModelSlot,
  modelDecisionSchema,
  preflight,
  toProactivityDecision,
  ProactivitySlotError,
} from './slot.js';
import type { GoalContext } from './types.js';

const now = '2026-11-04T09:00:00.000Z';

const context: GoalContext = {
  goal: {
    id: 'goal-1',
    ownerId: 'person-1',
    title: 'Keep groceries under £450',
    status: 'active',
    domains: ['finance'],
  },
  trigger: {
    kind: 'critical-change',
    id: 'change-1',
    ownerId: 'person-1',
    changedDomains: ['finance'],
    occurredAt: now,
  },
  previous: {
    id: 'before',
    asOf: '2026-10-28T09:00:00.000Z',
    evidence: [
      {
        id: 'ev-before',
        domain: 'finance',
        source: 'test',
        observedAt: '2026-10-28T09:00:00.000Z',
        facts: { monthlyGroceries: 412 },
      },
    ],
  },
  current: {
    id: 'after',
    asOf: now,
    evidence: [
      {
        id: 'ev-after',
        domain: 'finance',
        source: 'test',
        observedAt: now,
        facts: { monthlyGroceries: 487, budget: 450 },
      },
    ],
  },
};

const proposal = {
  kind: 'propose' as const,
  summary: 'Groceries are over the monthly limit',
  reason: 'Spend rose to £487 against a £450 budget.',
  nextStep: 'Review the grocery budget against this month’s spending.',
  evidenceIds: ['ev-after'],
};

describe('proactivity model slot', () => {
  it('builds a prompt with the goal, trigger, both states, and available evidence ids', () => {
    const prompt = buildProactivityPrompt(context);

    expect(prompt).toContain('Keep groceries under £450');
    expect(prompt).toContain('critical change in finance');
    expect(prompt).toContain('ev-before');
    expect(prompt).toContain('ev-after');
    expect(prompt).toContain('"monthlyGroceries": 487');
    expect(prompt).toContain('Available evidence ids');
  });

  it('returns a valid grounded decision', async () => {
    const generate = vi.fn(async () => proposal);
    const slot = createModelSlot({ generate });

    await expect(slot.evaluate(context)).resolves.toEqual(proposal);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('retries once when the decision does not match the schema', async () => {
    const generate = vi
      .fn()
      .mockResolvedValueOnce({ ...proposal, evidenceIds: [] })
      .mockResolvedValueOnce(proposal);
    const slot = createModelSlot({ generate });

    await expect(slot.evaluate(context)).resolves.toEqual(proposal);
    expect(generate).toHaveBeenCalledTimes(2);
    const secondCall = generate.mock.calls[1];
    if (!secondCall) throw new Error('Expected a second generate call.');
    expect(requestPrompt(secondCall[0])).toContain('did not match the decision schema');
  });

  it('retries when the decision cites evidence outside the goal context', async () => {
    const generate = vi
      .fn()
      .mockResolvedValueOnce({ ...proposal, evidenceIds: ['ev-invented'] })
      .mockResolvedValueOnce(proposal);
    const slot = createModelSlot({ generate });

    await expect(slot.evaluate(context)).resolves.toEqual(proposal);
    expect(generate).toHaveBeenCalledTimes(2);
    const secondCall = generate.mock.calls[1];
    if (!secondCall) throw new Error('Expected a second generate call.');
    const secondPrompt = requestPrompt(secondCall[0]);
    expect(secondPrompt).toContain('ev-invented');
    expect(secondPrompt).toContain('Use only these evidence ids');
  });

  it('sanitizes field names, evidence ids, and ISO dates in user-facing copy', async () => {
    const generate = vi.fn().mockResolvedValue({
      ...proposal,
      summary: 'ev-after shows the review is booked for 2026-11-05.',
      reason: 'monthlyGroceries rose to £487; see ev-after.',
    });
    const slot = createModelSlot({ generate });

    const decision = await slot.evaluate(context);
    expect(generate).toHaveBeenCalledTimes(1);
    if (decision.kind !== 'propose') throw new Error('Expected a proposal.');
    expect(decision.summary).not.toContain('ev-after');
    expect(decision.summary).toContain('the latest evidence');
    expect(decision.summary).toContain('5 November 2026');
    expect(decision.reason).not.toContain('monthlyGroceries');
    expect(decision.reason).toContain('monthly groceries');
  });

  it('retries when the next step recommends an irreversible action', async () => {
    const generate = vi
      .fn()
      .mockResolvedValueOnce({
        ...proposal,
        nextStep: 'Pay the £420 deposit today.',
      })
      .mockResolvedValueOnce(proposal);
    const slot = createModelSlot({ generate });

    await expect(slot.evaluate(context)).resolves.toEqual(proposal);
    expect(generate).toHaveBeenCalledTimes(2);
    const secondCall = generate.mock.calls[1];
    if (!secondCall) throw new Error('Expected a second generate call.');
    expect(requestPrompt(secondCall[0])).toContain('irreversible');
  });

  it('retries when the next step suggests moving funds', async () => {
    const generate = vi
      .fn()
      .mockResolvedValueOnce({
        ...proposal,
        nextStep: 'Move funds from savings to cover the deposit.',
      })
      .mockResolvedValueOnce(proposal);
    const slot = createModelSlot({ generate });

    await expect(slot.evaluate(context)).resolves.toEqual(proposal);
    expect(generate).toHaveBeenCalledTimes(2);
    const secondCall = generate.mock.calls[1];
    if (!secondCall) throw new Error('Expected a second generate call.');
    expect(requestPrompt(secondCall[0])).toContain('irreversible');
  });

  it('falls back to a safe next step when every attempt recommends an unsafe action', async () => {
    const generate = vi.fn(async () => ({
      ...proposal,
      nextStep: 'Pay the £420 deposit today.',
    }));
    const slot = createModelSlot({ generate, maxAttempts: 2 });

    const decision = await slot.evaluate(context);
    expect(generate).toHaveBeenCalledTimes(2);
    if (decision.kind !== 'propose') throw new Error('Expected a proposal.');
    expect(decision.summary).toBe(proposal.summary);
    expect(decision.nextStep).toBe('Review the change and decide which option fits your plan.');
  });

  it('fails after the attempt budget with the last error attached', async () => {
    const generate = vi.fn(async () => ({ ...proposal, evidenceIds: ['ev-invented'] }));
    const slot = createModelSlot({ generate, maxAttempts: 2 });

    await expect(slot.evaluate(context)).rejects.toBeInstanceOf(ProactivitySlotError);
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it('rejects a non-positive attempt budget', () => {
    expect(() => createModelSlot({ generate: async () => proposal, maxAttempts: 0 })).toThrow(
      'maxAttempts must be a positive integer.',
    );
  });
});

describe('model-facing decision shape', () => {
  const flat = {
    kind: 'propose' as const,
    summary: 'Groceries are over the monthly limit',
    reason: 'Spend rose to £487 against a £450 budget.',
    nextStep: 'Review the grocery budget.',
    reevaluateAt: null,
    evidenceIds: ['ev-after'],
  };

  it('normalizes a flat model decision into the internal union', () => {
    expect(toProactivityDecision(modelDecisionSchema.parse(flat))).toEqual({
      kind: 'propose',
      summary: flat.summary,
      reason: flat.reason,
      nextStep: flat.nextStep,
      evidenceIds: ['ev-after'],
    });
  });

  it('rejects a proposal without a summary', () => {
    expect(() =>
      toProactivityDecision(modelDecisionSchema.parse({ ...flat, summary: null })),
    ).toThrow();
  });

  it('defaults a missing reassessment time to one week out', () => {
    const decision = toProactivityDecision(
      modelDecisionSchema.parse({
        kind: 'defer',
        summary: null,
        reason: 'The reading is stale.',
        nextStep: null,
        reevaluateAt: null,
        evidenceIds: ['ev-after'],
      }),
    );

    expect(decision).toMatchObject({ kind: 'defer', evidenceIds: ['ev-after'] });
    expect(decision.kind === 'defer' && Date.parse(decision.reevaluateAt)).toBeGreaterThan(
      Date.now(),
    );
  });

  it('ends a reason that hits the length cap at a sentence boundary', () => {
    const decision = toProactivityDecision(
      modelDecisionSchema.parse({
        ...proposal,
        reason: `${'a'.repeat(150)}; ${'b'.repeat(108)}`,
        reevaluateAt: null,
      }),
    );

    if (decision.kind !== 'propose') throw new Error('Expected a proposal.');
    expect(decision.reason.length).toBeLessThanOrEqual(200);
    expect(decision.reason.endsWith('.')).toBe(true);
  });

  it('caps an over-length reason that already ends with a sentence terminator', () => {
    const decision = toProactivityDecision(
      modelDecisionSchema.parse({
        ...proposal,
        reason: `${'The trip moved and the deposit was refunded. '.repeat(8)}`,
        reevaluateAt: null,
      }),
    );

    if (decision.kind !== 'propose') throw new Error('Expected a proposal.');
    expect(decision.reason.length).toBeLessThanOrEqual(200);
  });

  it('drops unused fields from a quiet decision', () => {
    expect(
      toProactivityDecision(
        modelDecisionSchema.parse({
          kind: 'quiet',
          summary: 'ignored',
          reason: 'Nothing material changed.',
          nextStep: 'ignored',
          reevaluateAt: null,
          evidenceIds: [],
        }),
      ),
    ).toEqual({ kind: 'quiet', reason: 'Nothing material changed.', evidenceIds: [] });
  });

  it('normalizes a date-only reassessment time', () => {
    expect(
      toProactivityDecision(
        modelDecisionSchema.parse({
          kind: 'defer',
          summary: null,
          reason: 'The reading is stale.',
          nextStep: null,
          reevaluateAt: '2026-11-11',
          evidenceIds: ['ev-after'],
        }),
      ),
    ).toMatchObject({ kind: 'defer', reevaluateAt: '2026-11-11T09:00:00.000Z' });
  });

  it('normalizes an offset reassessment time to UTC', () => {
    expect(
      toProactivityDecision(
        modelDecisionSchema.parse({
          kind: 'defer',
          summary: null,
          reason: 'The reading is stale.',
          nextStep: null,
          reevaluateAt: '2026-11-11T09:00:00+00:00',
          evidenceIds: ['ev-after'],
        }),
      ),
    ).toMatchObject({ kind: 'defer', reevaluateAt: '2026-11-11T09:00:00.000Z' });
  });
});

describe('grounding preflight', () => {
  const evidence = context.current.evidence[0];
  if (!evidence) throw new Error('Test context is missing current evidence.');

  it('defers when there is no current evidence', () => {
    const guarded = preflight({
      ...context,
      current: { ...context.current, evidence: [] },
    });

    expect(guarded).toMatchObject({ kind: 'defer', evidenceIds: [] });
    expect(guarded?.reason).toContain('No current evidence');
  });

  it('defers when current evidence carries a blocking data-quality flag', () => {
    const guarded = preflight({
      ...context,
      current: {
        ...context.current,
        evidence: [{ ...evidence, facts: { dataQuality: 'duplicate_unreconciled' } }],
      },
    });

    expect(guarded).toMatchObject({ kind: 'defer', evidenceIds: ['ev-after'] });
    expect(guarded?.reason).toContain('duplicate_unreconciled');
  });

  it('defers when the newest current evidence is older than seven days', () => {
    const guarded = preflight({
      ...context,
      current: {
        ...context.current,
        evidence: [{ ...evidence, observedAt: '2026-10-15T09:00:00.000Z' }],
      },
    });

    expect(guarded).toMatchObject({ kind: 'defer', evidenceIds: ['ev-after'] });
    expect(guarded?.reason).toContain('seven days old');
  });

  it('returns quiet when the current state records an applied refund', () => {
    const guarded = preflight({
      ...context,
      current: {
        ...context.current,
        evidence: [
          {
            ...evidence,
            facts: { monthlyGroceries: 415, budget: 450, refund: 40, refundApplied: true },
          },
        ],
      },
    });

    expect(guarded).toMatchObject({ kind: 'quiet', evidenceIds: ['ev-after'] });
    expect(guarded?.reason).toContain('refund');
  });

  it('still defers when a refund carries a blocking data-quality flag', () => {
    const guarded = preflight({
      ...context,
      current: {
        ...context.current,
        evidence: [
          {
            ...evidence,
            facts: { refundApplied: true, dataQuality: 'duplicate_unreconciled' },
          },
        ],
      },
    });

    expect(guarded).toMatchObject({ kind: 'defer', evidenceIds: ['ev-after'] });
  });

  it('lets fresh, well-formed evidence through to the model', () => {
    expect(preflight(context)).toBeNull();
  });
});

function requestPrompt(value: unknown): string {
  if (typeof value === 'object' && value !== null) {
    const prompt = Reflect.get(value, 'prompt');
    if (typeof prompt === 'string') return prompt;
  }
  throw new Error('The generate request did not include a prompt.');
}
