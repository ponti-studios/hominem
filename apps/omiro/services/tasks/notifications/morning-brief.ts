import { storage } from '~/services/storage/mmkv';

import type { StoredTask } from '../sync/task-mapping';

export const MORNING_BRIEF_KEY = 'morning_brief_enabled';
// The brief lands before the 9:00 reminders for day-only tasks.
export const BRIEF_HOUR = 8;
// Only the next few mornings are scheduled: iOS keeps 64 pending local
// notifications and task reminders already use 60 (MAX_SCHEDULED).
export const BRIEF_DAYS = 3;
const TITLES_SHOWN = 3;

export const getMorningBriefEnabled = () => storage.getBoolean(MORNING_BRIEF_KEY) ?? false;

export const setMorningBriefEnabled = (value: boolean) => storage.set(MORNING_BRIEF_KEY, value);

export interface PlannedBrief {
  // Local calendar day, `YYYY-MM-DD`; one brief per day.
  day: string;
  at: Date;
  title: string;
  body: string;
}

const dayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

// One line per upcoming morning that has open tasks on it: how many, and the
// first few by time. A morning with nothing planned gets no notification.
export function planMorningBriefs(tasks: StoredTask[], now: Date): PlannedBrief[] {
  const dated = tasks.flatMap((task) => {
    const when = task.status === 'pending' && !task.deletedAt ? (task.startAt ?? task.dueAt) : null;
    const date = when ? new Date(when) : null;
    return date && !Number.isNaN(date.getTime()) ? [{ date, title: task.title }] : [];
  });

  return Array.from({ length: BRIEF_DAYS + 1 }, (_, offset) => {
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, BRIEF_HOUR);
    return at;
  })
    .filter((at) => at.getTime() > now.getTime())
    .slice(0, BRIEF_DAYS)
    .flatMap((at) => {
      const day = dayKey(at);
      const titles = dated
        .filter((entry) => dayKey(entry.date) === day)
        .sort((a, b) => a.date.getTime() - b.date.getTime())
        .map((entry) => entry.title);
      if (titles.length === 0) {
        return [];
      }
      const rest = titles.length - TITLES_SHOWN;
      return [
        {
          at,
          body: `${titles.slice(0, TITLES_SHOWN).join(', ')}${rest > 0 ? ` and ${rest} more` : ''}`,
          day,
          title: titles.length === 1 ? '1 task today' : `${titles.length} tasks today`,
        },
      ];
    });
}

export interface BriefScheduler {
  // Days (`YYYY-MM-DD`) that have a brief pending.
  scheduled: () => Promise<string[]>;
  schedule: (brief: PlannedBrief) => Promise<void>;
  cancel: (day: string) => Promise<void>;
}

// Replaces the pending briefs with the plan. There are at most BRIEF_DAYS of
// them and their text changes with every task edit, so they are rewritten
// rather than diffed.
export async function reconcileBriefs(scheduler: BriefScheduler, planned: PlannedBrief[]) {
  await Promise.all((await scheduler.scheduled()).map((day) => scheduler.cancel(day)));
  await Promise.all(planned.map((brief) => scheduler.schedule(brief)));
}
