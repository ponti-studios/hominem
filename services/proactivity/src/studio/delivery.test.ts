import { afterEach, describe, expect, it } from 'vitest';

import type { GoalContext, ProactivityTrigger } from '../types.js';
import { createStudioDeliveryPolicy } from './delivery.js';
import { StudioStore } from './store.js';

const now = '2026-11-05T17:10:00.000Z';

const context: GoalContext = {
  goal: {
    id: 'budget',
    ownerId: 'maya',
    title: 'Stay inside the monthly plan',
    status: 'active',
    domains: ['finance.budget'],
  },
  trigger: {
    kind: 'critical-change',
    id: 'grocery-sync',
    ownerId: 'maya',
    changedDomains: ['finance.budget'],
    occurredAt: now,
  },
  previous: null,
  current: {
    id: 'after',
    asOf: now,
    evidence: [
      {
        id: 'grocery-after',
        domain: 'finance',
        source: 'Monzo',
        observedAt: now,
        facts: { monthlyGroceries: 487 },
      },
    ],
  },
};

const trigger: ProactivityTrigger = context.trigger;

const stores: StudioStore[] = [];

function createStore(): StudioStore {
  const store = new StudioStore(':memory:');
  stores.push(store);
  return store;
}

afterEach(() => {
  while (stores.length > 0) stores.pop()?.close();
});

describe('studio delivery policy', () => {
  it('plans one email for a proposal and nothing for other decisions', async () => {
    const store = createStore();
    const policy = createStudioDeliveryPolicy({
      store,
      clock: { now: () => now },
      ownerFirstName: 'Maya',
    });

    const intents = await policy.plan({
      trigger,
      outcomes: [
        {
          context,
          decision: {
            kind: 'propose',
            summary: 'Groceries are £37 over the monthly plan.',
            reason: 'The supermarket sync moved spending to £487 against a £450 budget.',
            nextStep: 'Move £37 from the eating-out envelope.',
            evidenceIds: ['grocery-after'],
          },
        },
        {
          context,
          decision: {
            kind: 'defer',
            reason: 'The duplicate charge is unreconciled.',
            reevaluateAt: '2026-11-12T17:10:00.000Z',
            evidenceIds: ['grocery-after'],
          },
        },
        {
          context,
          decision: {
            kind: 'quiet',
            reason: 'The payment is on plan.',
            evidenceIds: ['grocery-after'],
          },
        },
      ],
    });

    expect(intents).toHaveLength(1);
    expect(intents[0]).toMatchObject({
      kind: 'goal-proposal',
      ownerId: 'maya',
      goalId: 'budget',
      channel: 'email',
      subject: 'Groceries are £37 over the monthly plan.',
      idempotencyKey: 'grocery-sync:budget',
    });
    expect(intents[0]?.body).toContain('Hi Maya');
    expect(intents[0]?.body).toContain('Move £37 from the eating-out envelope.');
    expect(intents[0]?.body).toContain('Stay inside the monthly plan');
  });

  it('suppresses a proposal while a preference is live and restores it after', async () => {
    const store = createStore();
    const policy = createStudioDeliveryPolicy({
      store,
      clock: { now: () => now },
      ownerFirstName: 'Maya',
    });
    const outcomes = [
      {
        context,
        decision: {
          kind: 'propose' as const,
          summary: 'Groceries are £37 over the monthly plan.',
          reason: 'The supermarket sync moved spending to £487 against a £450 budget.',
          nextStep: 'Move £37 from the eating-out envelope.',
          evidenceIds: ['grocery-after'],
        },
      },
    ];

    store.setPreference('budget', 'snooze', '2026-11-08T17:10:00.000Z', now);
    await expect(policy.plan({ trigger, outcomes })).resolves.toEqual([]);

    store.clearPreference('budget');
    await expect(policy.plan({ trigger, outcomes })).resolves.toHaveLength(1);
  });
});
