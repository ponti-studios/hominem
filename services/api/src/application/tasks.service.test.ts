import { pool } from '@hominem/db/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { persistExtractedTasks } from './tasks.service';

const userId = 'd3000001-0000-4000-8000-000000000001';

beforeAll(async () => {
  await pool.query(`DELETE FROM "user" WHERE id = $1`, [userId]);
  await pool.query(
    `INSERT INTO "user" (id, name, email, "emailVerified") VALUES ($1, $2, $3, $4)`,
    [userId, 'Tasks Service Test User', `${userId}@test.hominem.dev`, true],
  );
});

afterAll(async () => {
  await pool.query(`DELETE FROM "user" WHERE id = $1`, [userId]);
});

describe('persistExtractedTasks', () => {
  it('creates nothing for empty input', async () => {
    const result = await persistExtractedTasks(userId, {});
    expect(result).toEqual({ groups: [], tasks: [] });
  });

  it('creates a single standalone task with no parent', async () => {
    const result = await persistExtractedTasks(userId, {
      tasks: [{ title: 'Return the overdue library book' }],
    });

    expect(result.groups).toEqual([]);
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0]).toMatchObject({
      title: 'Return the overdue library book',
      artifactType: 'task',
      parentTaskId: null,
    });
  });

  it('creates independent standalone tasks with no shared parent', async () => {
    const result = await persistExtractedTasks(userId, {
      tasks: [
        { title: 'Renew gym membership' },
        { title: 'Follow up with the accountant' },
        { title: 'Fix the leaky bathroom faucet' },
      ],
    });

    expect(result.groups).toEqual([]);
    expect(result.tasks).toHaveLength(3);
    for (const task of result.tasks) {
      expect(task.parentTaskId).toBeNull();
    }
  });

  it('creates one task_list group titled by the caller, with children pointing at it', async () => {
    const result = await persistExtractedTasks(userId, {
      groups: [
        {
          title: 'Plan London trip',
          tasks: [{ title: 'Book flight to London' }, { title: 'Book hotel near King’s Cross' }],
        },
      ],
    });

    expect(result.tasks).toEqual([]);
    expect(result.groups).toHaveLength(1);
    const [group] = result.groups;
    expect(group.parent).toMatchObject({ title: 'Plan London trip', artifactType: 'task_list' });
    expect(group.tasks).toHaveLength(2);
    for (const task of group.tasks) {
      expect(task.parentTaskId).toBe(group.parent.id);
    }
  });

  it('creates multiple groups plus standalone tasks in one call', async () => {
    const result = await persistExtractedTasks(userId, {
      groups: [
        {
          title: 'Plan London trip',
          tasks: [{ title: 'Book flight' }, { title: 'Book hotel' }],
        },
        {
          title: 'Prep for job interview',
          tasks: [{ title: 'Update resume' }, { title: 'Research the company' }],
        },
      ],
      tasks: [{ title: 'Cancel gym membership' }],
    });

    expect(result.groups).toHaveLength(2);
    expect(result.groups[0].parent.title).toBe('Plan London trip');
    expect(result.groups[1].parent.title).toBe('Prep for job interview');
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].title).toBe('Cancel gym membership');
  });
});
