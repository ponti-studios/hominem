import { describe, expect, it, vi } from 'vitest';

import { createProactivityEngine } from './engine.js';
import { InMemoryJournal } from './memory.js';
import type {
  DeliveryIntent,
  Goal,
  GoalContext,
  ProactivityDecision,
  ProactivityTrigger,
  StateSnapshot,
} from './types.js';

const now = '2026-11-02T12:00:00.000Z';

const makeGoal = (id: string, domains: string[], status: Goal['status'] = 'active'): Goal => ({
  id,
  ownerId: 'person-1',
  title: id,
  status,
  domains,
});

const makeSnapshot = (id: string, domain: string): StateSnapshot => ({
  id,
  asOf: now,
  evidence: [
    {
      id: `${id}-evidence`,
      domain,
      source: 'mock',
      observedAt: now,
      facts: { amount: 100 },
    },
  ],
});

const makeContext = (goal: Goal, trigger: ProactivityTrigger): GoalContext => ({
  goal,
  trigger,
  previous: makeSnapshot(`${goal.id}-previous`, goal.domains[0] ?? 'finance'),
  current: makeSnapshot(`${goal.id}-current`, goal.domains[0] ?? 'finance'),
});

const proposal = (evidenceIds: string[] = []): ProactivityDecision => ({
  kind: 'propose',
  summary: 'The goal is at risk.',
  reason: 'The current state changed.',
  nextStep: 'Review the plan.',
  evidenceIds,
});

const quiet = (): ProactivityDecision => ({
  kind: 'quiet',
  reason: 'No useful change.',
  evidenceIds: [],
});

const criticalChange = (id = 'change-1', changedDomains = ['finance']): ProactivityTrigger => ({
  kind: 'critical-change',
  id,
  ownerId: 'person-1',
  changedDomains,
  occurredAt: now,
});

const scheduledPass = (id = 'pass-1'): ProactivityTrigger => ({
  kind: 'scheduled-pass',
  id,
  ownerId: 'person-1',
  asOf: now,
});

const makeIntent = (goalId: string): Extract<DeliveryIntent, { kind: 'goal-proposal' }> => ({
  idempotencyKey: `goal-proposal:${goalId}`,
  ownerId: 'person-1',
  goalId,
  kind: 'goal-proposal',
  channel: 'email',
  subject: 'Goal update',
  body: 'A mock update grounded in supplied state.',
  sendAt: now,
});

const makeWeeklyIntent = (): Extract<DeliveryIntent, { kind: 'weekly-summary' }> => ({
  idempotencyKey: 'weekly-summary:all',
  ownerId: 'person-1',
  goalId: null,
  kind: 'weekly-summary',
  channel: 'email',
  subject: 'Goal update',
  body: 'A mock update grounded in supplied state.',
  sendAt: now,
});

function makeHarness(options?: {
  goals?: Goal[];
  decisions?: Record<string, ProactivityDecision>;
  contexts?: Record<string, GoalContext>;
  plan?: DeliveryIntent[];
}) {
  const goals = options?.goals ?? [
    makeGoal('savings', ['finance']),
    makeGoal('career', ['career']),
  ];
  const contexts = options?.contexts ?? {};
  const decisions = options?.decisions ?? {};
  const journal = new InMemoryJournal();
  const evaluate = vi.fn(async (context: GoalContext) => decisions[context.goal.id] ?? quiet());
  const load = vi.fn(
    async (goal: Goal, trigger: ProactivityTrigger) =>
      contexts[goal.id] ?? makeContext(goal, trigger),
  );
  const plan = vi.fn(async () => options?.plan ?? []);
  const engine = createProactivityEngine({
    goals: { list: async (ownerId) => goals.filter((goal) => goal.ownerId === ownerId) },
    contexts: { load },
    slot: { evaluate },
    deliveryPolicy: { plan },
    journal,
    clock: { now: () => now },
  });
  return { engine, evaluate, journal, load, plan };
}

describe('proactivity engine', () => {
  it('evaluates only active goals that overlap a critical change', async () => {
    const savings = makeGoal('savings', ['finance']);
    const career = makeGoal('career', ['career']);
    const paused = makeGoal('paused', ['finance'], 'paused');
    const { engine, evaluate, load } = makeHarness({ goals: [savings, career, paused] });

    const run = await engine.run(criticalChange());

    expect(evaluate).toHaveBeenCalledTimes(1);
    expect(evaluate.mock.calls[0]?.[0].goal.id).toBe('savings');
    expect(load).toHaveBeenCalledTimes(1);
    expect(run.evaluations.map(({ goalId }) => goalId)).toEqual(['savings']);
  });

  it('evaluates every active goal on a scheduled pass', async () => {
    const { engine, evaluate, load } = makeHarness();

    const run = await engine.run(scheduledPass());

    expect(evaluate).toHaveBeenCalledTimes(2);
    expect(load).toHaveBeenCalledTimes(2);
    expect(run.evaluations.map(({ goalId }) => goalId)).toEqual(['savings', 'career']);
  });

  it('records a quiet decision and does not create a delivery intent by itself', async () => {
    const { engine, journal, plan } = makeHarness();

    const run = await engine.run(criticalChange());

    expect(run.evaluations[0]?.decision.kind).toBe('quiet');
    expect(run.deliveryIntents).toEqual([]);
    expect(await journal.find('person-1', 'change-1')).toEqual(run);
    expect(plan).toHaveBeenCalledOnce();
  });

  it('keeps prior and current evidence available to a replaceable evaluator slot', async () => {
    const goal = makeGoal('savings', ['finance']);
    const trigger = criticalChange();
    const context = makeContext(goal, trigger);
    const { engine, evaluate } = makeHarness({ contexts: { savings: context } });

    await engine.run(trigger);

    expect(evaluate.mock.calls[0]?.[0]).toEqual(context);
    expect(evaluate.mock.calls[0]?.[0].previous?.id).toBe('savings-previous');
    expect(evaluate.mock.calls[0]?.[0].current.id).toBe('savings-current');
  });

  it('stores delivery intents with the evaluation run without sending them', async () => {
    const decision = proposal(['savings-current-evidence']);
    const plan = [makeIntent('savings')];
    const { engine, journal } = makeHarness({ decisions: { savings: decision }, plan });

    const run = await engine.run(criticalChange());

    expect(run.evaluations[0]?.decision).toEqual(decision);
    expect(run.deliveryIntents).toEqual(plan);
    expect(await journal.find('person-1', 'change-1')).toEqual(run);
  });

  it('routes an imminent budget proposal to an email intent through the delivery policy', async () => {
    const budget = makeGoal('monthly-budget', ['finance']);
    const decision = proposal(['monthly-budget-current-evidence']);
    const email = makeIntent('monthly-budget');
    const { engine } = makeHarness({
      goals: [budget],
      decisions: { 'monthly-budget': decision },
      plan: [email],
    });

    const run = await engine.run(criticalChange('budget-overrun', ['finance']));

    expect(run.evaluations[0]?.decision).toEqual(decision);
    expect(run.deliveryIntents).toEqual([email]);
    expect(run.deliveryIntents[0]).toMatchObject({
      kind: 'goal-proposal',
      channel: 'email',
      goalId: 'monthly-budget',
    });
  });

  it('returns the saved run for a repeated trigger without reevaluating or replanning', async () => {
    const plan = [makeIntent('savings')];
    const {
      engine,
      evaluate,
      plan: makePlan,
    } = makeHarness({
      decisions: { savings: proposal(['savings-current-evidence']) },
      plan,
    });
    const trigger = criticalChange();
    const firstRun = await engine.run(trigger);

    const repeatedRun = await engine.run(trigger);

    expect(repeatedRun).toEqual(firstRun);
    expect(evaluate).toHaveBeenCalledTimes(1);
    expect(makePlan).toHaveBeenCalledOnce();
  });

  it('rejects a slot decision that cites evidence outside its context', async () => {
    const { engine } = makeHarness({ decisions: { savings: proposal(['invented-evidence']) } });

    await expect(engine.run(criticalChange())).rejects.toThrow(/evidence/i);
  });

  it('can create a weekly summary intent even when every goal decision is quiet', async () => {
    const weeklyTrigger: ProactivityTrigger = {
      kind: 'weekly-summary',
      id: 'week-2026-11-02',
      ownerId: 'person-1',
      asOf: now,
    };
    const summary = makeWeeklyIntent();
    const { engine, evaluate } = makeHarness({ plan: [summary] });

    const run = await engine.run(weeklyTrigger);

    expect(evaluate).toHaveBeenCalledTimes(2);
    expect(run.evaluations.every(({ decision }) => decision.kind === 'quiet')).toBe(true);
    expect(run.deliveryIntents).toEqual([summary]);
  });

  it('does not persist a partial run if the evaluator slot fails', async () => {
    const journal = new InMemoryJournal();
    const engine = createProactivityEngine({
      goals: { list: async () => [makeGoal('savings', ['finance'])] },
      contexts: { load: async (goal, trigger) => makeContext(goal, trigger) },
      slot: { evaluate: async () => Promise.reject(new Error('slot unavailable')) },
      deliveryPolicy: { plan: async () => [] },
      journal,
      clock: { now: () => now },
    });

    await expect(engine.run(criticalChange())).rejects.toThrow('slot unavailable');
    expect(await journal.find('person-1', 'change-1')).toBeNull();
  });

  it('selects no goals for an unrelated critical change but records the handled trigger', async () => {
    const { engine, evaluate, journal } = makeHarness();

    const run = await engine.run(criticalChange('change-health', ['health']));

    expect(evaluate).not.toHaveBeenCalled();
    expect(run.evaluations).toEqual([]);
    expect(await journal.find('person-1', 'change-health')).toEqual(run);
  });
});
