import type { CalendarEventGateway } from '~/services/calendar/calendar-event-gateway';

import type { TimeBlock } from './time-types';

const DEFAULT_EVENT_MINUTES = 60;

type CalendarWriter = Pick<
  CalendarEventGateway,
  'createEvent' | 'getPermission' | 'requestPermission'
>;

// A task that is scheduled for a specific time also goes on the user's own
// calendar, so they see it where they already look. Best effort: never throws,
// and a task with only a deadline (no start time) is not an event. Returns
// whether an event was created.
export async function addScheduledTaskToCalendar(
  gateway: CalendarWriter,
  block: Pick<TimeBlock, 'duration' | 'end_time' | 'location' | 'start_time'>,
  title: string,
): Promise<boolean> {
  if (!block.start_time) {
    return false;
  }
  try {
    let permission = await gateway.getPermission();
    if (permission === 'notDetermined') {
      permission = await gateway.requestPermission();
    }
    if (permission !== 'authorized') {
      return false;
    }
    const end =
      block.end_time ??
      new Date(
        new Date(block.start_time).getTime() + (block.duration ?? DEFAULT_EVENT_MINUTES) * 60_000,
      ).toISOString();
    await gateway.createEvent(title, block.start_time, end, block.location, null);
    return true;
  } catch {
    return false;
  }
}
