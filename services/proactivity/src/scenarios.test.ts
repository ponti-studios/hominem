import { describe, expect, it } from 'vitest';

import { createProactivityEngine } from './engine.js';
import { InMemoryJournal } from './memory.js';
import { goalScenarios } from './scenarios.js';
import type { DeliveryIntent, GoalOutcome, ProactivityTrigger } from './types.js';

const now = '2026-11-02T12:00:00.000Z';

describe('mock goal scenarios', () => {
  it('runs all ten cross-domain goal cases through the same scheduled engine flow', async () => {
    const journal = new InMemoryJournal();
    const trigger: ProactivityTrigger = {
      kind: 'scheduled-pass',
      id: 'synthetic-weekly-sweep',
      ownerId: 'synthetic-person',
      asOf: now,
    };
    const engine = makeScenarioEngine(journal, false);

    const run = await engine.run(trigger);

    expect(run.evaluations).toHaveLength(10);
    expect(run.evaluations.map(({ goalId }) => goalId)).toEqual(
      goalScenarios.map(({ goal }) => goal.id),
    );
    for (const evaluation of run.evaluations) {
      const scenario = goalScenarios.find(({ goal }) => goal.id === evaluation.goalId);
      expect(evaluation.decision).toEqual(scenario?.expectedDecision);
    }
    expect(run.deliveryIntents.map(({ goalId }) => goalId)).toEqual(
      goalScenarios
        .filter(({ expectedDecision }) => expectedDecision.kind === 'propose')
        .map(({ goal }) => goal.id),
    );
    expect(await journal.find('synthetic-person', trigger.id)).toEqual(run);
  });

  it('produces a weekly email intent from the same current-state scenarios', async () => {
    const engine = makeScenarioEngine(new InMemoryJournal(), true);
    const trigger: ProactivityTrigger = {
      kind: 'weekly-summary',
      id: 'synthetic-weekly-summary',
      ownerId: 'synthetic-person',
      asOf: now,
    };

    const run = await engine.run(trigger);

    expect(run.evaluations).toHaveLength(10);
    expect(run.deliveryIntents.at(-1)).toMatchObject({
      kind: 'weekly-summary',
      channel: 'email',
      goalId: null,
    });
  });
});

function intentsFor(trigger: ProactivityTrigger, outcomes: GoalOutcome[]): DeliveryIntent[] {
  return outcomes.flatMap(({ context, decision }) => {
    if (decision.kind !== 'propose') return [];
    return [
      {
        kind: 'goal-proposal' as const,
        idempotencyKey: `${trigger.id}:${context.goal.id}`,
        ownerId: trigger.ownerId,
        goalId: context.goal.id,
        channel: 'email' as const,
        subject: decision.summary,
        body: `${decision.reason} ${decision.nextStep}`,
        sendAt: now,
      },
    ];
  });
}

function makeScenarioEngine(journal: InMemoryJournal, includeWeeklySummary: boolean) {
  const scenarios = new Map(goalScenarios.map((scenario) => [scenario.goal.id, scenario]));
  return createProactivityEngine({
    goals: { list: async () => goalScenarios.map(({ goal }) => goal) },
    contexts: {
      load: async (goal, trigger) => {
        const scenario = scenarios.get(goal.id);
        if (!scenario) throw new Error(`Missing scenario for goal ${goal.id}.`);
        return { goal, trigger, previous: scenario.previous, current: scenario.current };
      },
    },
    slot: {
      evaluate: async (context) => {
        const scenario = scenarios.get(context.goal.id);
        if (!scenario) throw new Error(`Missing scenario for goal ${context.goal.id}.`);
        return scenario.expectedDecision;
      },
    },
    deliveryPolicy: {
      plan: async ({ trigger, outcomes }) => [
        ...intentsFor(trigger, outcomes),
        ...(includeWeeklySummary
          ? [
              {
                idempotencyKey: `weekly-summary:${trigger.id}`,
                ownerId: trigger.ownerId,
                goalId: null,
                kind: 'weekly-summary' as const,
                channel: 'email' as const,
                subject: 'Your week across active goals',
                body: 'A synthetic summary based on the current goal scenarios.',
                sendAt: now,
              },
            ]
          : []),
      ],
    },
    journal,
    clock: { now: () => now },
  });
}
