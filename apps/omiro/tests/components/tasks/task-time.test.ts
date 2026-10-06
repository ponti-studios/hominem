import { describe, expect, it } from 'vitest';

import {
  ageLabel,
  dayLabel,
  getDatedTasks,
  getInboxTasks,
  isDateOnly,
  isStale,
  placeOptions,
  taskTimeLabel,
} from '~/components/tasks/task-time';

import { makeTaskListItem } from '../../fixtures';

// Local-time constructors, because the app places tasks on local days.
const wed = new Date(2026, 9, 7, 15, 30); // Wed Oct 7 2026
const fri = new Date(2026, 9, 9, 8, 0);
const sat = new Date(2026, 9, 10, 8, 0);
const sun = new Date(2026, 9, 11, 8, 0);
const mon = new Date(2026, 9, 12, 8, 0);

function days(options: ReturnType<typeof placeOptions>) {
  return Object.fromEntries(options.map((o) => [o.key, o.date.getDate()]));
}

describe('inbox and dated tasks', () => {
  const tasks = [
    makeTaskListItem('dated', { dueAt: '2026-10-08T10:00:00.000Z' }),
    makeTaskListItem('block', {
      startAt: '2026-10-08T09:00:00.000Z',
      dueAt: '2026-10-08T10:00:00.000Z',
    }),
    makeTaskListItem('undated'),
    makeTaskListItem('done-undated', { status: 'completed' }),
    makeTaskListItem('done-dated', { status: 'completed', dueAt: '2026-10-08T10:00:00.000Z' }),
  ];

  it('lists only open tasks that have a day as dated', () => {
    expect(getDatedTasks(tasks).map((t) => t.id)).toEqual(['dated', 'block']);
  });

  it('lists only open tasks with no day as the inbox', () => {
    expect(getInboxTasks(tasks).map((t) => t.id)).toEqual(['undated']);
  });
});

describe('placeOptions', () => {
  it('offers today, tomorrow, the coming Saturday and next Monday', () => {
    expect(days(placeOptions(wed))).toEqual({ today: 7, tomorrow: 8, weekend: 10, nextWeek: 12 });
  });

  it('drops a choice that repeats an earlier day', () => {
    // On a Friday, Saturday is tomorrow.
    expect(days(placeOptions(fri))).toEqual({ today: 9, tomorrow: 10, nextWeek: 12 });
  });

  it('moves the weekend a week on once it is Saturday', () => {
    expect(days(placeOptions(sat))).toEqual({ today: 10, tomorrow: 11, weekend: 17, nextWeek: 12 });
  });

  it('on Sunday the weekend is next Saturday and next week starts tomorrow', () => {
    expect(days(placeOptions(sun))).toEqual({ today: 11, weekend: 17, tomorrow: 12 });
  });

  it('on Monday next week is a full week away', () => {
    expect(days(placeOptions(mon)).nextWeek).toBe(19);
  });

  it('places tasks at local midnight', () => {
    for (const option of placeOptions(wed)) {
      expect(isDateOnly(option.date.toISOString())).toBe(true);
    }
  });
});

describe('labels', () => {
  it('names a day relative to now', () => {
    expect(dayLabel(new Date(2026, 9, 7), wed)).toBe('Today');
    expect(dayLabel(new Date(2026, 9, 8), wed)).toBe('Tomorrow');
    expect(dayLabel(new Date(2026, 9, 9), wed)).toBe(
      new Date(2026, 9, 9).toLocaleDateString(undefined, { weekday: 'long' }),
    );
  });

  it('shows a day for a date-only task and a clock time for a timed one', () => {
    const dateOnly = new Date(2026, 9, 8).toISOString();
    const timed = new Date(2026, 9, 8, 14, 30).toISOString();

    expect(taskTimeLabel({ startAt: null, dueAt: dateOnly }, wed)).toBe('Tomorrow');
    expect(taskTimeLabel({ startAt: null, dueAt: timed }, wed)).toMatch(/2:30/);
    expect(taskTimeLabel({ startAt: null, dueAt: null }, wed)).toBeNull();
  });

  it('words how long ago a task was added', () => {
    expect(ageLabel(0)).toBe('Added today');
    expect(ageLabel(1)).toBe('Added yesterday');
    expect(ageLabel(3)).toBe('Added 3 days ago');
  });
});

describe('isStale', () => {
  it('flags a task undated for 14 days or more', () => {
    const now = new Date('2026-10-20T12:00:00.000Z');
    expect(isStale({ createdAt: '2026-10-06T12:00:00.000Z' }, now)).toBe(true);
    expect(isStale({ createdAt: '2026-10-07T12:00:00.000Z' }, now)).toBe(false);
    expect(isStale({ createdAt: null }, now)).toBe(false);
  });
});
