import { describe, expect, it } from 'vitest';

import {
  fromLabel,
  groupTasks,
  moveOptions,
  moveToDayPatch,
  UPCOMING_VISIBLE,
} from '~/components/tasks/task-time';

import { makeTaskListItem } from '../../fixtures';

const now = new Date(2026, 9, 7, 12, 0); // Wed Oct 7 2026

function at(day: number, hour = 0, minute = 0) {
  return new Date(2026, 9, day, hour, minute).toISOString();
}

describe('groupTasks', () => {
  it('splits open tasks into carried over, today and upcoming', () => {
    const sections = groupTasks(
      [
        makeTaskListItem('old', { dueAt: at(5) }),
        makeTaskListItem('later-today', { dueAt: at(7, 18) }),
        makeTaskListItem('early-today', { dueAt: at(7, 8) }),
        makeTaskListItem('tomorrow', { dueAt: at(8) }),
        makeTaskListItem('inbox'),
      ],
      now,
    );
    expect(sections.carriedOver.map((task) => task.id)).toEqual(['old']);
    expect(sections.today.map((task) => task.id)).toEqual(['early-today', 'later-today']);
    expect(sections.upcoming.map((task) => task.id)).toEqual(['tomorrow']);
    expect(sections.moreThisWeek).toBe(0);
  });

  it('caps upcoming, counts the rest of the week, and hides what is further out', () => {
    const week = Array.from({ length: UPCOMING_VISIBLE + 2 }, (_, index) =>
      makeTaskListItem(`w${index}`, { dueAt: at(8 + (index % 4)) }),
    );
    const sections = groupTasks([...week, makeTaskListItem('far', { dueAt: at(30) })], now);
    expect(sections.upcoming).toHaveLength(UPCOMING_VISIBLE);
    expect(sections.moreThisWeek).toBe(2);
    expect(sections.upcoming.some((task) => task.id === 'far')).toBe(false);
  });

  it('uses the start of a time block as its day', () => {
    const sections = groupTasks(
      [makeTaskListItem('block', { startAt: at(7, 10), dueAt: at(7, 11, 30) })],
      now,
    );
    expect(sections.today).toHaveLength(1);
  });

  it('counts tasks finished today so an empty Today reads as done', () => {
    const sections = groupTasks(
      [
        makeTaskListItem('done', {
          dueAt: at(7, 9),
          status: 'completed',
          completedAt: at(7, 10),
        }),
        makeTaskListItem('done-yesterday', {
          dueAt: at(6),
          status: 'completed',
          completedAt: at(6, 10),
        }),
      ],
      now,
    );
    expect(sections.today).toHaveLength(0);
    expect(sections.doneToday).toBe(1);
  });
});

describe('fromLabel', () => {
  it('names where a carried-over task came from', () => {
    expect(fromLabel({ startAt: null, dueAt: at(6) }, now)).toBe('From yesterday');
    expect(fromLabel({ startAt: null, dueAt: at(5) }, now)).toBe('From Mon');
    expect(fromLabel({ startAt: null, dueAt: new Date(2026, 8, 28).toISOString() }, now)).toBe(
      'From Sep 28',
    );
  });
});

describe('moveOptions', () => {
  it('offers tomorrow, Saturday and next Monday', () => {
    const options = moveOptions(now);
    expect(options.map((option) => option.key)).toEqual(['tomorrow', 'saturday', 'nextMonday']);
    expect(options.map((option) => option.detail)).toEqual(['Thu', 'Oct 10', 'Oct 12']);
  });

  it('drops an option that lands on an earlier one', () => {
    const friday = new Date(2026, 9, 9, 12, 0);
    const keys = moveOptions(friday).map((option) => option.key);
    expect(keys).toEqual(['tomorrow', 'nextMonday']);
  });
});

describe('moveToDayPatch', () => {
  it('keeps the time of day and the block length', () => {
    const patch = moveToDayPatch(
      { startAt: at(5, 10), dueAt: at(5, 11, 30) },
      new Date(2026, 9, 9),
    );
    expect(patch.startAt).toBe(at(9, 10));
    expect(patch.dueAt).toBe(at(9, 11, 30));
  });

  it('keeps a day-only task day-only', () => {
    const patch = moveToDayPatch({ startAt: null, dueAt: at(5) }, new Date(2026, 9, 9));
    expect(patch).toEqual({ startAt: null, dueAt: at(9) });
  });
});
