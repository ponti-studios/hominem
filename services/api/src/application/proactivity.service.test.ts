import { db, pool } from '@hominem/db/core';
import type { GoalContext, ProactivityDecision } from '@hominem/proactivity';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { runScheduledPass } from './proactivity-schedule.service';
import { loadOverview, runEvaluation } from './proactivity.service';

const ownerId = 'd3000021-0000-4000-8000-000000000001';
const otherId = 'd3000021-0000-4000-8000-000000000002';
const accountId = 'd3000021-0000-4000-8000-000000000011';
const financeGoalId = 'd3000021-0000-4000-8000-000000000021';

/** Deterministic stand-in for the model: proposes from the supplied evidence. */
const proposingSlot = {
  async evaluate(context: GoalContext): Promise<ProactivityDecision> {
    return {
      kind: 'propose',
      summary: 'Spend is running ahead of income this month.',
      reason: 'The current month shows spend above income.',
      nextStep: 'Review discretionary spending.',
      evidenceIds: [context.current.evidence[0]!.id],
    };
  },
};

async function seedFinance(userId: string) {
  await db
    .insertInto('app.financeAccounts')
    .values({
      id: accountId,
      userId,
      name: 'Current account',
      accountType: 'checking',
      currencyCode: 'GBP',
    })
    .execute();
  await pool.query(
    `INSERT INTO app.finance_transactions
       (user_id, account_id, amount, transaction_type, merchant_name, posted_on, currency_code)
     VALUES
       ($1, $2,  5000.00, 'credit', 'Employer',  date_trunc('month', now()) - interval '1 month', 'GBP'),
       ($1, $2, -1200.00, 'debit',  'Landlord',  date_trunc('month', now()) - interval '1 month' + interval '4 days', 'GBP'),
       ($1, $2,  3000.00, 'credit', 'Employer',  date_trunc('month', now()), 'GBP'),
       ($1, $2, -4500.00, 'debit',  'Agency',    date_trunc('month', now()) + interval '1 day', 'GBP')`,
    [userId, accountId],
  );
}

beforeAll(async () => {
  for (const id of [ownerId, otherId]) {
    await pool.query(`DELETE FROM "user" WHERE id = $1`, [id]);
    await pool.query(
      `INSERT INTO "user" (id, name, email, "emailVerified") VALUES ($1, $2, $3, true)`,
      [id, 'Proactivity Service Test User', `${id}@test.hominem.dev`],
    );
  }
  await seedFinance(ownerId);
  await db
    .insertInto('app.goals')
    .values([
      {
        id: financeGoalId,
        ownerUserid: ownerId,
        title: 'Stay inside the monthly plan',
        domains: ['finance'],
      },
      { ownerUserid: ownerId, title: 'Sleep better', domains: ['health'] },
      { ownerUserid: otherId, title: 'Other owner goal', domains: ['finance'] },
    ])
    .execute();
});

afterAll(async () => {
  for (const id of [ownerId, otherId]) {
    await pool.query(`DELETE FROM "user" WHERE id = $1`, [id]);
  }
  await pool.end();
});

describe('proactivity service on real data', () => {
  const trigger = {
    kind: 'scheduled-pass' as const,
    id: 'scheduled-2026-11-24',
    ownerId,
    asOf: '2026-11-24T09:00:00.000Z',
  };

  it('evaluates only active goals whose domains have data, grounded in real rows', async () => {
    const run = await runEvaluation(ownerId, { slot: proposingSlot, trigger });

    expect(run.evaluations).toHaveLength(1);
    expect(run.evaluations[0]).toMatchObject({
      ownerId,
      triggerId: trigger.id,
      goalId: financeGoalId,
      decision: { kind: 'propose' },
    });
    const decision = run.evaluations[0]!.decision;
    if (decision.kind !== 'propose') throw new Error('expected a proposal');
    expect(decision.evidenceIds.length).toBeGreaterThan(0);
    expect(run.deliveryIntents).toHaveLength(1);
    expect(run.deliveryIntents[0]).toMatchObject({
      kind: 'goal-proposal',
      ownerId,
      goalId: financeGoalId,
      channel: 'email',
    });
  });

  it('persists the run, replays the same trigger idempotently, and serves it in the overview', async () => {
    const first = await runEvaluation(ownerId, { slot: proposingSlot, trigger });
    const replay = await runEvaluation(ownerId, { slot: proposingSlot, trigger });

    expect(replay.processedAt).toBe(first.processedAt);
    const stored = await pool.query(
      `SELECT count(*)::int AS count FROM app.proactivity_runs WHERE owner_userid = $1`,
      [ownerId],
    );
    expect(stored.rows[0].count).toBe(1);

    const overview = await loadOverview(ownerId);
    expect(overview.goals.map((goal) => goal.title).sort()).toEqual([
      'Sleep better',
      'Stay inside the monthly plan',
    ]);
    expect(overview.finance?.months).toHaveLength(2);
    expect(overview.career).toBeNull();
    expect(overview.lastRun).toEqual(first);
  });

  it('keeps other owners separate', async () => {
    const overview = await loadOverview(otherId);
    expect(overview.finance).toBeNull();
    expect(overview.lastRun).toBeNull();
    expect(overview.goals.map((goal) => goal.title)).toEqual(['Other owner goal']);

    const otherRun = await runEvaluation(otherId, {
      slot: proposingSlot,
      trigger: { ...trigger, ownerId: otherId },
    });
    expect(otherRun.evaluations).toEqual([]);
  });

  it('sweeps owners with active goals once per day', async () => {
    const day = new Date('2026-11-26T09:00:00.000Z');
    const sweep = await runScheduledPass({ now: day, slot: proposingSlot });
    expect(sweep.owners).toBeGreaterThanOrEqual(2);

    const overview = await loadOverview(ownerId);
    expect(overview.lastRun).toMatchObject({
      ownerId,
      triggerId: 'scheduled-2026-11-26',
      processedAt: day.toISOString(),
    });

    const replay = await runScheduledPass({
      now: new Date('2026-11-26T21:00:00.000Z'),
      slot: proposingSlot,
    });
    expect(replay.evaluated).toBe(sweep.evaluated);
    expect((await loadOverview(ownerId)).lastRun?.processedAt).toBe(day.toISOString());

    const nextDay = await runScheduledPass({
      now: new Date('2026-11-27T09:00:00.000Z'),
      slot: proposingSlot,
    });
    expect(nextDay.owners).toBeGreaterThanOrEqual(2);
    expect((await loadOverview(ownerId)).lastRun?.triggerId).toBe('scheduled-2026-11-27');
  });
});
