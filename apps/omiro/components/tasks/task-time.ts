import { formatClockTime } from '~/services/date/format-date';
import type { TaskListItem } from '~/services/tasks/task-types';

const DAY_MS = 86_400_000;
// Undated tasks older than this come up in triage as "Still want this?".
export const STALE_AFTER_DAYS = 14;

export function getOpenTasks(tasks: TaskListItem[]) {
  return tasks.filter((task) => task.status !== 'completed');
}

export function hasDate(task: Pick<TaskListItem, 'dueAt' | 'startAt'>) {
  return Boolean(task.dueAt || task.startAt);
}

// Open tasks with a day: the list you act on.
export function getDatedTasks(tasks: TaskListItem[]) {
  return getOpenTasks(tasks).filter(hasDate);
}

// Open tasks with no day yet, waiting to be placed.
export function getInboxTasks(tasks: TaskListItem[]) {
  return getOpenTasks(tasks).filter((task) => !hasDate(task));
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

// A task placed on a day, not a time, is stored as that day's local midnight.
export function isDateOnly(value: string): boolean {
  const date = new Date(value);
  return (
    date.getHours() === 0 &&
    date.getMinutes() === 0 &&
    date.getSeconds() === 0 &&
    date.getMilliseconds() === 0
  );
}

export function dayLabel(value: string | Date, now: Date = new Date()): string {
  const date = startOfDay(new Date(value));
  const diff = Math.round((date.getTime() - startOfDay(now).getTime()) / DAY_MS);
  if (diff === 0) {
    return 'Today';
  }
  if (diff === 1) {
    return 'Tomorrow';
  }
  const withinWeek = diff > 1 && diff < 7;
  return date.toLocaleDateString(
    undefined,
    withinWeek ? { weekday: 'long' } : { weekday: 'short', month: 'short', day: 'numeric' },
  );
}

// "9:00 – 10:00", a single time, a day for a date-only task, or null when the
// task has no date at all.
export function taskTimeLabel(
  { dueAt, startAt }: Pick<TaskListItem, 'dueAt' | 'startAt'>,
  now: Date = new Date(),
) {
  if (startAt && dueAt) {
    return `${formatClockTime(startAt)} – ${formatClockTime(dueAt)}`;
  }
  const when = startAt ?? dueAt;
  if (!when) {
    return null;
  }
  return isDateOnly(when) ? dayLabel(when, now) : formatClockTime(when);
}

export interface PlaceOption {
  key: 'today' | 'tomorrow' | 'weekend' | 'nextWeek';
  label: string;
  // The day the task is placed on, as local midnight.
  date: Date;
}

// The quick dates offered in triage. A choice that lands on the same day as an
// earlier one is dropped (on a Friday, "This weekend" is not also Saturday's
// "Tomorrow").
export function placeOptions(now: Date = new Date()): PlaceOption[] {
  const today = startOfDay(now);
  const day = today.getDay();
  const daysToSaturday = day === 6 ? 7 : (6 - day + 7) % 7;
  const daysToMonday = (1 - day + 7) % 7 || 7;
  const options: PlaceOption[] = [
    { key: 'today', label: 'Today', date: today },
    { key: 'tomorrow', label: 'Tomorrow', date: addDays(today, 1) },
    { key: 'weekend', label: 'This weekend', date: addDays(today, daysToSaturday) },
    { key: 'nextWeek', label: 'Next week', date: addDays(today, daysToMonday) },
  ];
  const seen = new Set<number>();
  return options.filter((option) => {
    const time = option.date.getTime();
    if (seen.has(time)) {
      return false;
    }
    seen.add(time);
    return true;
  });
}

export function taskAgeDays(task: Pick<TaskListItem, 'createdAt'>, now: Date = new Date()) {
  if (!task.createdAt) {
    return 0;
  }
  return Math.max(0, Math.floor((now.getTime() - new Date(task.createdAt).getTime()) / DAY_MS));
}

export function isStale(task: Pick<TaskListItem, 'createdAt'>, now: Date = new Date()) {
  return taskAgeDays(task, now) >= STALE_AFTER_DAYS;
}

export function ageLabel(days: number): string {
  if (days <= 0) {
    return 'Added today';
  }
  return days === 1 ? 'Added yesterday' : `Added ${days} days ago`;
}

// How far ahead the Upcoming section looks, and how many rows it shows.
export const UPCOMING_DAYS = 7;
export const UPCOMING_VISIBLE = 3;

export interface TaskSections {
  // Open tasks from an earlier day, oldest first.
  carriedOver: TaskListItem[];
  today: TaskListItem[];
  // The next few days' tasks, capped; `moreThisWeek` counts the rest.
  upcoming: TaskListItem[];
  moreThisWeek: number;
  // Finished today, so an empty Today reads as done rather than unplanned.
  doneToday: number;
}

function taskDay(task: Pick<TaskListItem, 'dueAt' | 'startAt'>): Date | null {
  const when = task.startAt ?? task.dueAt;
  return when ? startOfDay(new Date(when)) : null;
}

// Splits dated tasks into the Tasks tab's three sections. Tasks further out
// than the Upcoming window stay out of sight until their week.
export function groupTasks(tasks: TaskListItem[], now: Date = new Date()): TaskSections {
  const today = startOfDay(now).getTime();
  const horizon = addDays(startOfDay(now), UPCOMING_DAYS).getTime();
  const sections: TaskSections = {
    carriedOver: [],
    today: [],
    upcoming: [],
    moreThisWeek: 0,
    doneToday: 0,
  };
  const inWeek: TaskListItem[] = [];
  const byTime = (a: TaskListItem, b: TaskListItem) =>
    new Date(a.startAt ?? a.dueAt ?? 0).getTime() - new Date(b.startAt ?? b.dueAt ?? 0).getTime();

  for (const task of tasks) {
    if (task.status === 'completed') {
      if (task.completedAt && startOfDay(new Date(task.completedAt)).getTime() === today) {
        sections.doneToday += 1;
      }
      continue;
    }
    const day = taskDay(task)?.getTime();
    if (day === undefined) {
      continue;
    }
    if (day < today) {
      sections.carriedOver.push(task);
    } else if (day === today) {
      sections.today.push(task);
    } else if (day <= horizon) {
      inWeek.push(task);
    }
  }
  inWeek.sort(byTime);
  sections.carriedOver.sort(byTime);
  sections.today.sort(byTime);
  sections.upcoming = inWeek.slice(0, UPCOMING_VISIBLE);
  sections.moreThisWeek = inWeek.length - sections.upcoming.length;
  return sections;
}

// "From Mon" for a task carried over from an earlier day.
export function fromLabel(task: Pick<TaskListItem, 'dueAt' | 'startAt'>, now: Date = new Date()) {
  const day = taskDay(task);
  if (!day) {
    return '';
  }
  const diff = Math.round((startOfDay(now).getTime() - day.getTime()) / DAY_MS);
  if (diff <= 1) {
    return 'From yesterday';
  }
  return diff < 7
    ? `From ${day.toLocaleDateString(undefined, { weekday: 'short' })}`
    : `From ${day.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

export interface MoveOption {
  key: 'tomorrow' | 'saturday' | 'nextMonday';
  label: string;
  // Weekday or date shown at the row's end.
  detail: string;
  date: Date;
}

// The quick dates in the Move sheet: tomorrow, the coming Saturday and the
// Monday after. Options landing on the same day collapse into the first.
export function moveOptions(now: Date = new Date()): MoveOption[] {
  const today = startOfDay(now);
  const day = today.getDay();
  const tomorrow = addDays(today, 1);
  const saturday = addDays(today, day === 6 ? 7 : (6 - day + 7) % 7);
  const monday = addDays(today, (1 - day + 7) % 7 || 7);
  const options: MoveOption[] = [
    {
      key: 'tomorrow',
      label: 'Tomorrow',
      detail: tomorrow.toLocaleDateString(undefined, { weekday: 'short' }),
      date: tomorrow,
    },
    {
      key: 'saturday',
      label: 'Saturday',
      detail: saturday.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      date: saturday,
    },
    {
      key: 'nextMonday',
      label: 'Next Monday',
      detail: monday.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      date: monday,
    },
  ];
  const seen = new Set<number>();
  return options.filter((option) => {
    const time = option.date.getTime();
    if (seen.has(time)) {
      return false;
    }
    seen.add(time);
    return true;
  });
}

// The same clock time on another day; a day-only value stays day-only.
function onDay(value: string, day: Date): string {
  const time = new Date(value);
  return new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    time.getHours(),
    time.getMinutes(),
    time.getSeconds(),
    time.getMilliseconds(),
  ).toISOString();
}

// The edit that moves a task to `day`, keeping its time of day and block length.
export function moveToDayPatch(task: Pick<TaskListItem, 'dueAt' | 'startAt'>, day: Date) {
  return {
    startAt: task.startAt ? onDay(task.startAt, day) : null,
    dueAt: task.dueAt ? onDay(task.dueAt, day) : startOfDay(day).toISOString(),
  };
}
