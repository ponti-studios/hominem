import type { CalendarEvent } from '~/modules/on-device-ai';
import { formatClockTime } from '~/services/date/format-date';
import type { TaskListItem } from '~/services/tasks/task-types';

import type { TimeBlock, TimeItem } from './time-types';

const DEFAULT_AVAILABILITY_DAYS = 7;

export function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

export function itemDate(item: TimeItem) {
  return item.kind === 'task' ? (item.value.startAt ?? item.value.dueAt) : item.value.startDate;
}

// Local calendar day, `YYYY-MM-DD`. The key every day lookup uses, so a day
// never depends on the time of day an item or the strip was built at.
export function localDayKey(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function stripDays(start: Date, count: number): Date[] {
  return Array.from({ length: count }, (_, offset) => {
    const day = new Date(start);
    day.setDate(day.getDate() + offset);
    return day;
  });
}

// Pastel fills for calendar blocks, chosen by a stable hash of the calendar
// (or title) so a given calendar keeps its color.
export const EVENT_TONES = ['eventViolet', 'eventCoral', 'eventSky', 'eventSun'] as const;
export type EventTone = (typeof EVENT_TONES)[number];

export function eventTone(seed: string): EventTone {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return EVENT_TONES[hash % EVENT_TONES.length];
}

function itemSortKey(item: TimeItem) {
  // All-day events lead their day.
  if (item.kind === 'event' && item.value.isAllDay) {
    return Number.NEGATIVE_INFINITY;
  }
  return new Date(itemDate(item) ?? 0).getTime();
}

// Every scheduled item (calendar events plus tasks with a start or due time),
// grouped by local day and sorted within it. Built once per data change; day
// selection is then an O(1) map lookup.
export function buildDayIndex({
  events,
  tasks,
}: {
  events: CalendarEvent[];
  tasks: TaskListItem[];
}): Map<string, TimeItem[]> {
  const items: TimeItem[] = events.map((value) => ({ kind: 'event' as const, value }));
  for (const value of tasks) {
    if (value.startAt ?? value.dueAt) {
      items.push({ kind: 'task', value });
    }
  }
  const index = new Map<string, TimeItem[]>();
  for (const item of items.sort((left, right) => itemSortKey(left) - itemSortKey(right))) {
    const key = localDayKey(new Date(itemDate(item) ?? 0));
    const bucket = index.get(key);
    if (bucket) {
      bucket.push(item);
    } else {
      index.set(key, [item]);
    }
  }
  return index;
}

export function itemTimeLabel(item: TimeItem): string {
  if (item.kind === 'event') {
    return item.value.isAllDay
      ? 'All day'
      : `${formatClockTime(item.value.startDate)} – ${formatClockTime(item.value.endDate)}`;
  }
  const { dueAt, startAt } = item.value;
  if (startAt && dueAt) {
    return `${formatClockTime(startAt)} – ${formatClockTime(dueAt)}`;
  }
  const when = startAt ?? dueAt;
  return when ? formatClockTime(when) : 'Anytime';
}

export type DayRow = { kind: 'item'; item: TimeItem } | { kind: 'now' };

// A day's rows with the "now" marker slotted before the first item that
// starts after it. Pure: easy to test and cheap to recompute on day change.
export function buildDayRows(items: TimeItem[], now: Date | null): DayRow[] {
  const rows: DayRow[] = items.map((item) => ({ item, kind: 'item' }));
  if (!now) {
    return rows;
  }
  const nowMs = now.getTime();
  const at = items.findIndex((item) => {
    if (item.kind === 'event' && item.value.isAllDay) {
      return false;
    }
    return new Date(itemDate(item) ?? 0).getTime() > nowMs;
  });
  rows.splice(at === -1 ? rows.length : at, 0, { kind: 'now' });
  return rows;
}

export function itemHasEnded(item: TimeItem, now: Date): boolean {
  if (item.kind === 'event') {
    return !item.value.isAllDay && new Date(item.value.endDate) <= now;
  }
  return false;
}

export function getUnscheduledTasks(tasks: TaskListItem[]) {
  return tasks.filter((task) => !task.startAt && !task.dueAt && task.status !== 'completed');
}

export function getOpenTasks(tasks: TaskListItem[]) {
  return tasks.filter((task) => task.status !== 'completed');
}

export function getAvailabilityRange(block: TimeBlock, now = new Date()) {
  const start = block.scheduling_window_start
    ? new Date(block.scheduling_window_start)
    : new Date(now);
  const end = block.scheduling_window_end
    ? new Date(block.scheduling_window_end)
    : new Date(start.getTime() + DEFAULT_AVAILABILITY_DAYS * 24 * 60 * 60 * 1000);
  return { start, end };
}

export function formatDraftWhen(timeBlock: TimeBlock | null): string | null {
  if (!timeBlock) {
    return null;
  }
  if (timeBlock.start_time && timeBlock.end_time) {
    return `${new Date(timeBlock.start_time).toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })} – ${formatClockTime(timeBlock.end_time)}`;
  }
  if (timeBlock.scheduling_window_start) {
    return `${new Date(timeBlock.scheduling_window_start).toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    })}${timeBlock.duration ? ` · ${timeBlock.duration} min` : ''}`;
  }
  if (timeBlock.deadline_fixed) {
    return `Due ${new Date(`${timeBlock.deadline_fixed}T12:00:00`).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })}`;
  }
  if (timeBlock.duration) {
    return `Unscheduled · ${timeBlock.duration} min`;
  }
  return null;
}
