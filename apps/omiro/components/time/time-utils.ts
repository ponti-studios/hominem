import type { CalendarEvent } from '~/modules/on-device-ai';
import { formatClockTime } from '~/services/date/format-date';
import type { TaskListItem } from '~/services/tasks/task-types';

import type { TimeBlock, TimeItem, TimeOpening, TimeStreamRow } from './time-types';

const DEFAULT_AVAILABILITY_DAYS = 7;

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

export function itemDate(item: TimeItem | TimeStreamRow) {
  if (item.kind !== 'task' && item.kind !== 'event') {
    return null;
  }
  return item.kind === 'task' ? (item.value.startAt ?? item.value.dueAt) : item.value.startDate;
}

export function dayKey(item: TimeItem) {
  const date = new Date(itemDate(item) ?? 0);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function dayLabel(item: TimeItem) {
  const date = new Date(itemDate(item) ?? 0);
  const today = startOfToday();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  }
  if (date.toDateString() === tomorrow.toDateString()) {
    return 'Tomorrow';
  }
  return date.toLocaleDateString(undefined, { weekday: 'long' });
}

export interface TimeColumnParts {
  primary: string;
  secondary?: string;
}

export function eventTimeParts(event: CalendarEvent): TimeColumnParts {
  if (event.isAllDay) {
    return { primary: 'All day' };
  }
  return {
    primary: formatClockTime(event.startDate),
    secondary: formatClockTime(event.endDate),
  };
}

export function taskTimeParts(task: TaskListItem): TimeColumnParts {
  const date = task.startAt ?? task.dueAt;
  if (!date) {
    return { primary: '—' };
  }
  return {
    primary: formatClockTime(date),
  };
}

const ACCENT_TOKEN_COUNT = 5;

export function accentTokenIndex(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash % ACCENT_TOKEN_COUNT;
}

function getScheduledTimeItems({
  events,
  loadedUntil,
  tasks,
}: {
  events: CalendarEvent[];
  loadedUntil: Date;
  tasks: TaskListItem[];
}): TimeItem[] {
  const items: TimeItem[] = events.map((value) => ({ kind: 'event' as const, value }));
  for (const value of tasks) {
    if (value.startAt ?? value.dueAt) {
      items.push({ kind: 'task', value });
    }
  }
  return items
    .filter((item) => {
      const date = itemDate(item);
      return date ? new Date(date).getTime() < loadedUntil.getTime() : false;
    })
    .sort(
      (left, right) =>
        new Date(itemDate(left) ?? 0).getTime() - new Date(itemDate(right) ?? 0).getTime(),
    );
}

export function buildTimeStreamRows({
  events,
  loadedUntil,
  now = new Date(),
  tasks,
}: {
  events: CalendarEvent[];
  loadedUntil: Date;
  now?: Date;
  tasks: TaskListItem[];
}): TimeStreamRow[] {
  const scheduledItems = getScheduledTimeItems({ events, loadedUntil, tasks });
  const isPast = (item: TimeItem) => {
    const date = itemDate(item);
    if (!date) {
      return false;
    }
    if (item.kind === 'event') {
      return new Date(item.value.endDate) <= now;
    }
    return item.value.status === 'completed' || new Date(date) < now;
  };
  return scheduledItems.filter((item) => !isPast(item));
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

export function findOpenings({
  events,
  range,
  tasks,
  durationMinutes,
}: {
  durationMinutes: number;
  events: CalendarEvent[];
  range: { end: Date; start: Date };
  tasks: TaskListItem[];
}): TimeOpening[] {
  const busy: { end: Date; start: Date }[] = [];
  const addBusyInterval = (start: Date, end: Date) => {
    const clippedStart = new Date(Math.max(start.getTime(), range.start.getTime()));
    const clippedEnd = new Date(Math.min(end.getTime(), range.end.getTime()));
    if (clippedEnd > clippedStart) {
      busy.push({ end: clippedEnd, start: clippedStart });
    }
  };
  for (const event of events) {
    addBusyInterval(new Date(event.startDate), new Date(event.endDate));
  }
  for (const task of tasks) {
    if (task.startAt && task.dueAt) {
      addBusyInterval(new Date(task.startAt), new Date(task.dueAt));
    }
  }
  busy.sort((left, right) => left.start.getTime() - right.start.getTime());
  const openings: TimeOpening[] = [];
  let cursor = range.start;
  const durationMs = durationMinutes * 60 * 1000;

  for (const interval of busy) {
    if (interval.start.getTime() - cursor.getTime() >= durationMs) {
      openings.push({
        start: cursor.toISOString(),
        end: new Date(cursor.getTime() + durationMs).toISOString(),
      });
    }
    if (interval.end > cursor) {
      cursor = interval.end;
    }
    if (openings.length === 3) {
      return openings;
    }
  }

  if (range.end.getTime() - cursor.getTime() >= durationMs) {
    openings.push({
      start: cursor.toISOString(),
      end: new Date(cursor.getTime() + durationMs).toISOString(),
    });
  }
  return openings.slice(0, 3);
}

export function findEventCandidates(
  events: CalendarEvent[],
  targetTitle: string | null,
  now: Date = new Date(),
) {
  const normalizedTitle = targetTitle?.trim().toLocaleLowerCase();
  if (!normalizedTitle) {
    return [];
  }
  const nowMs = now.getTime();
  return events.filter(
    (event) =>
      event.title.trim().toLocaleLowerCase() === normalizedTitle &&
      new Date(event.endDate).getTime() >= nowMs,
  );
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
