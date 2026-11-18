import { describe, expect, it, vi } from 'vitest';

import {
  BRIEF_DAYS,
  planMorningBriefs,
  reconcileBriefs,
  type PlannedBrief,
} from '~/services/tasks/notifications/morning-brief';
import type { StoredTask } from '~/services/tasks/sync/task-mapping';

vi.mock('~/services/storage/mmkv', () => ({
  storage: { getBoolean: () => undefined, set: vi.fn() },
}));

// 07:00 local on Tue 17 Nov 2026: this morning's brief is still ahead.
const NOW = new Date(2026, 10, 17, 7);

function task(title: string, when: Date | null, overrides: Partial<StoredTask> = {}): StoredTask {
  return {
    completedAt: null,
    createdAt: null,
    deletedAt: null,
    dueAt: when ? when.toISOString() : null,
    id: title,
    listTitle: null,
    location: null,
    notes: null,
    priority: 'none',
    startAt: null,
    status: 'pending',
    title,
    updatedAt: null,
    ...overrides,
  };
}

describe('planMorningBriefs', () => {
  it('summarizes each upcoming morning that has tasks, earliest task first', () => {
    const briefs = planMorningBriefs(
      [
        task('Call bank', new Date(2026, 10, 17, 15)),
        task('Standup', new Date(2026, 10, 17, 10)),
        task('Dentist', new Date(2026, 10, 18, 9)),
      ],
      NOW,
    );
    expect(briefs.map(({ day, title, body }) => ({ day, title, body }))).toEqual([
      { day: '2026-11-17', title: '2 tasks today', body: 'Standup, Call bank' },
      { day: '2026-11-18', title: '1 task today', body: 'Dentist' },
    ]);
    expect(briefs[0]?.at).toEqual(new Date(2026, 10, 17, 8));
  });

  it('names three tasks and counts the rest', () => {
    const many = ['A', 'B', 'C', 'D', 'E'].map((title, index) =>
      task(title, new Date(2026, 10, 17, 9 + index)),
    );
    expect(planMorningBriefs(many, NOW)[0]).toMatchObject({
      body: 'A, B, C and 2 more',
      title: '5 tasks today',
    });
  });

  it('skips this morning once its brief time has passed', () => {
    const afterBrief = new Date(2026, 10, 17, 8, 30);
    const briefs = planMorningBriefs([task('Later', new Date(2026, 10, 17, 15))], afterBrief);
    expect(briefs).toEqual([]);
  });

  it('ignores undated, completed and deleted tasks, and days beyond the window', () => {
    const briefs = planMorningBriefs(
      [
        task('Someday', null),
        task('Done', new Date(2026, 10, 17, 10), { status: 'completed' }),
        task('Gone', new Date(2026, 10, 17, 10), { deletedAt: NOW.toISOString() }),
        task('Far', new Date(2026, 10, 17 + BRIEF_DAYS, 10)),
      ],
      NOW,
    );
    expect(briefs).toEqual([]);
  });

  it('files a time block under the day it starts', () => {
    const block = task('Deep work', new Date(2026, 10, 18, 1), {
      startAt: new Date(2026, 10, 17, 23).toISOString(),
    });
    expect(planMorningBriefs([block], NOW).map((brief) => brief.day)).toEqual(['2026-11-17']);
  });
});

describe('reconcileBriefs', () => {
  it('replaces whatever was pending with the plan', async () => {
    const pending = new Set(['2026-11-16', '2026-11-17']);
    const scheduler = {
      cancel: async (day: string) => {
        pending.delete(day);
      },
      schedule: async (brief: PlannedBrief) => {
        pending.add(brief.day);
      },
      scheduled: async () => [...pending],
    };
    await reconcileBriefs(scheduler, [
      { at: new Date(2026, 10, 18, 8), body: 'Dentist', day: '2026-11-18', title: '1 task today' },
    ]);
    expect([...pending]).toEqual(['2026-11-18']);
  });
});
