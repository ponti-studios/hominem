import { describe, expect, it } from 'vitest';

import type { TimeBlock, TimeItem } from '~/components/time/time-types';
import {
  buildDayIndex,
  buildDayRows,
  EVENT_TONES,
  eventTone,
  getAvailabilityRange,
  itemTimeLabel,
  localDayKey,
  stripDays,
} from '~/components/time/time-utils';
import type { CalendarEvent } from '~/modules/on-device-ai';
import type { TaskListItem } from '~/services/tasks/task-types';

const event = (overrides: Partial<CalendarEvent> = {}): CalendarEvent => ({
  calendarTitle: 'Work',
  endDate: '2026-07-28T11:00:00.000Z',
  id: 'event-1',
  isAllDay: false,
  isEditable: true,
  location: null,
  notes: null,
  participants: [],
  recurrenceDescription: null,
  startDate: '2026-07-28T10:00:00.000Z',
  title: 'Planning',
  ...overrides,
});

const task = (overrides: Partial<TaskListItem> = {}): TaskListItem => ({
  completedAt: null,
  createdAt: '2026-07-28T09:00:00.000Z',
  notes: null,
  dueAt: '2026-07-28T10:30:00.000Z',
  id: 'task-1',
  location: null,
  listTitle: 'Omiro',
  priority: 'medium',
  startAt: '2026-07-28T10:00:00.000Z',
  status: 'pending',
  title: 'Write brief',
  ...overrides,
});

describe('Time day index', () => {
  it('keeps task rows available without calendar permission', () => {
    const index = buildDayIndex({ events: [], tasks: [task()] });

    const items = [...index.values()].flat();
    expect(items.map((item) => item.kind)).toEqual(['task']);
  });

  it('groups events and tasks by local day and sorts within a day', () => {
    const day = (iso: string) => localDayKey(new Date(iso));
    const index = buildDayIndex({
      events: [
        event({
          id: 'late',
          startDate: '2026-07-28T15:00:00.000Z',
          endDate: '2026-07-28T16:00:00.000Z',
        }),
        event({
          id: 'early',
          startDate: '2026-07-28T08:00:00.000Z',
          endDate: '2026-07-28T09:00:00.000Z',
        }),
        event({
          id: 'next-day',
          startDate: '2026-07-30T08:00:00.000Z',
          endDate: '2026-07-30T09:00:00.000Z',
        }),
      ],
      tasks: [task({ startAt: '2026-07-28T10:00:00.000Z', dueAt: '2026-07-28T10:30:00.000Z' })],
    });

    expect(index.get(day('2026-07-28T10:00:00.000Z'))?.map((item) => item.value.id)).toEqual([
      'early',
      'task-1',
      'late',
    ]);
    expect(index.get(day('2026-07-30T08:00:00.000Z'))).toHaveLength(1);
  });

  it('leads a day with all-day events and ignores tasks without a time', () => {
    const index = buildDayIndex({
      events: [
        event({
          id: 'timed',
          startDate: '2026-07-28T08:00:00.000Z',
          endDate: '2026-07-28T09:00:00.000Z',
        }),
        event({
          id: 'all-day',
          isAllDay: true,
          startDate: '2026-07-28T07:00:00.000Z',
          endDate: '2026-07-29T07:00:00.000Z',
        }),
      ],
      tasks: [task({ startAt: null, dueAt: null })],
    });

    const items = [...index.values()].flat();
    expect(items.map((item) => item.value.id)).toEqual(['all-day', 'timed']);
  });

  it('labels events and tasks by their time', () => {
    expect(itemTimeLabel({ kind: 'event', value: event({ isAllDay: true }) })).toBe('All day');
    expect(itemTimeLabel({ kind: 'task', value: task({ startAt: null, dueAt: null }) })).toBe(
      'Anytime',
    );
  });
});

describe('eventTone', () => {
  it('is stable for a given seed and stays within the palette', () => {
    expect(eventTone('Work')).toBe(eventTone('Work'));
    expect(EVENT_TONES).toContain(eventTone('Family'));
  });
});

describe('stripDays', () => {
  it('returns consecutive local days', () => {
    const days = stripDays(new Date(2026, 6, 30), 3);

    expect(days.map(localDayKey)).toEqual(['2026-07-30', '2026-07-31', '2026-08-01']);
  });
});

describe('Time availability', () => {
  it('uses the next seven local days when parsing does not provide a window', () => {
    const range = getAvailabilityRange(
      {
        primary_intent: 'schedule_gap_fill',
        title: null,
        target_title: null,
        participants: null,
        location: null,
        duration: null,
        start_time: null,
        end_time: null,
        scheduling_window_start: null,
        scheduling_window_end: null,
        deadline_fixed: null,
        recurrence_rule: null,
      } satisfies TimeBlock,
      new Date('2026-07-27T09:00:00.000Z'),
    );

    expect(range.start.toISOString()).toBe('2026-07-27T09:00:00.000Z');
    expect(range.end.toISOString()).toBe('2026-08-03T09:00:00.000Z');
  });
});

describe('buildDayRows', () => {
  const items = (): TimeItem[] => [
    {
      kind: 'event',
      value: event({
        id: 'early',
        startDate: '2026-07-28T08:00:00.000Z',
        endDate: '2026-07-28T09:00:00.000Z',
      }),
    },
    {
      kind: 'event',
      value: event({
        id: 'late',
        startDate: '2026-07-28T15:00:00.000Z',
        endDate: '2026-07-28T16:00:00.000Z',
      }),
    },
  ];

  it('places the now marker before the first item that starts after it', () => {
    const rows = buildDayRows(items(), new Date('2026-07-28T12:00:00.000Z'));

    expect(rows.map((row) => row.kind)).toEqual(['item', 'now', 'item']);
  });

  it('puts the marker last once the day is over and omits it for other days', () => {
    expect(buildDayRows(items(), new Date('2026-07-28T20:00:00.000Z')).at(-1)?.kind).toBe('now');
    expect(buildDayRows(items(), null).map((row) => row.kind)).toEqual(['item', 'item']);
  });
});
