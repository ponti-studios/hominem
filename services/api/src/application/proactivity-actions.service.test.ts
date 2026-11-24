import { randomUUID } from 'node:crypto';

import { db, pool } from '@hominem/db/core';
import { NotFoundError } from '@hominem/db/errors';
import { GoalsRepository } from '@hominem/db/goals';
import { ProactivityRunsRepository } from '@hominem/db/proactivity';
import { afterEach, describe, expect, it } from 'vitest';

import { applyProactivityAction, undoProactivityAction } from './proactivity-actions.service';

const users: string[] = [];

async function createUser(): Promise<string> {
  const id = randomUUID();
  users.push(id);
  await pool.query(`INSERT INTO "user" (id, name, email) VALUES ($1, $2, $3)`, [
    id,
    'Proactivity action test',
    `${id}@example.com`,
  ]);
  return id;
}

async function seed(ownerId: string, otherId: string) {
  const goal = await GoalsRepository.create(db, {
    userId: ownerId,
    title: 'Stay inside the monthly plan',
    domains: ['finance'],
  });
  const otherGoal = await GoalsRepository.create(db, {
    userId: otherId,
    title: 'Other owner goal',
    domains: ['finance'],
  });
  const triggerId = 'manual-actions-test';
  await ProactivityRunsRepository.commit(db, {
    ownerId,
    triggerId,
    processedAt: '2026-11-24T09:00:00.000Z',
    run: {
      ownerId,
      triggerId,
      processedAt: '2026-11-24T09:00:00.000Z',
      evaluations: [
        {
          ownerId,
          triggerId,
          goalId: goal.id,
          evaluatedAt: '2026-11-24T09:00:00.000Z',
          decision: {
            kind: 'propose',
            summary: 'November is short.',
            reason: 'Spend is above income.',
            nextStep: 'Review November spending and decide what to pause.',
            evidenceIds: ['ev-fin-2026-11-flows'],
          },
        },
      ],
      deliveryIntents: [],
    },
  });
  return { goal, otherGoal, triggerId };
}

afterEach(async () => {
  for (const id of users.splice(0)) {
    await pool.query(`DELETE FROM "user" WHERE id = $1`, [id]);
  }
});

describe('proactivity actions', () => {
  it('creates a task once, undoes it, and allows a fresh action afterwards', async () => {
    const owner = await createUser();
    const other = await createUser();
    const { goal, triggerId } = await seed(owner, other);

    const action = await applyProactivityAction(owner, {
      triggerId,
      goalId: goal.id,
      kind: 'task.create',
    });
    expect(action).toMatchObject({ kind: 'task.create', status: 'applied', goalId: goal.id });
    expect(action.taskId).toBeTruthy();

    const replay = await applyProactivityAction(owner, {
      triggerId,
      goalId: goal.id,
      kind: 'task.create',
    });
    expect(replay.id).toBe(action.id);

    const task = await db
      .selectFrom('app.tasks')
      .selectAll()
      .where('id', '=', action.taskId!)
      .executeTakeFirst();
    expect(task?.ownerUserid).toBe(owner);
    expect(task?.deletedAt).toBeNull();

    const undone = await undoProactivityAction(owner, action.id);
    expect(undone.status).toBe('undone');
    const deleted = await db
      .selectFrom('app.tasks')
      .selectAll()
      .where('id', '=', action.taskId!)
      .executeTakeFirst();
    expect(deleted?.deletedAt).not.toBeNull();

    const again = await applyProactivityAction(owner, {
      triggerId,
      goalId: goal.id,
      kind: 'task.create',
    });
    expect(again.id).not.toBe(action.id);
    expect(again.status).toBe('applied');
  });

  it('pauses an active goal and restores it on undo', async () => {
    const owner = await createUser();
    const other = await createUser();
    const { goal, triggerId } = await seed(owner, other);

    const action = await applyProactivityAction(owner, {
      triggerId,
      goalId: goal.id,
      kind: 'goal.pause',
    });
    expect(await GoalsRepository.getOwned(db, { id: goal.id, userId: owner })).toMatchObject({
      status: 'paused',
    });

    await undoProactivityAction(owner, action.id);
    expect(await GoalsRepository.getOwned(db, { id: goal.id, userId: owner })).toMatchObject({
      status: 'active',
    });
  });

  it('records a snooze with its reassessment time', async () => {
    const owner = await createUser();
    const other = await createUser();
    const { goal, triggerId } = await seed(owner, other);

    const action = await applyProactivityAction(owner, {
      triggerId,
      goalId: goal.id,
      kind: 'finding.snooze',
    });
    expect(action.until).toBeTruthy();
    expect(Date.parse(action.until!)).toBeGreaterThan(Date.now());
  });

  it('refuses another owner’s run or goal', async () => {
    const owner = await createUser();
    const other = await createUser();
    const { triggerId, otherGoal } = await seed(owner, other);

    await expect(
      applyProactivityAction(other, { triggerId, goalId: otherGoal.id, kind: 'task.create' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('refuses to undo another owner’s action', async () => {
    const owner = await createUser();
    const other = await createUser();
    const { goal, triggerId } = await seed(owner, other);
    const action = await applyProactivityAction(owner, {
      triggerId,
      goalId: goal.id,
      kind: 'finding.snooze',
    });

    await expect(undoProactivityAction(other, action.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});
