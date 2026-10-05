import { formatClockTime } from '~/services/date/format-date';

import type { TimeBlock } from './time-types';

const DEFAULT_AVAILABILITY_DAYS = 7;

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
