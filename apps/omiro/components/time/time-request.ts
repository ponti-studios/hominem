import type {
  CalendarDraft,
  CalendarEvent,
  CalendarEventSummary,
  CalendarPermissionStatus,
  TaskBusyInterval,
} from '~/modules/on-device-ai';
import type { CalendarEventGateway } from '~/services/calendar/calendar-event-gateway';
import { formatClockTime } from '~/services/date/format-date';

import type { TimeBlock, TimeOpening } from './time-types';
import { getAvailabilityRange } from './time-utils';

const DAY_MS = 24 * 60 * 60 * 1000;
const UPCOMING_EVENT_DAYS = 90;
const DEFAULT_EVENT_MINUTES = 60;
const DEFAULT_GAP_MINUTES = 30;

export type RequestResult =
  | { kind: 'answer'; answer: string }
  | { kind: 'availability'; block: TimeBlock; openings: TimeOpening[]; submittedPrompt: string }
  | { kind: 'draft'; block: TimeBlock; submittedPrompt: string }
  | { kind: 'event-choice'; candidates: CalendarEvent[]; submittedPrompt: string }
  | { kind: 'open-event'; event: CalendarEvent }
  | { kind: 'present-draft'; draft: CalendarDraft; submittedPrompt: string }
  | { kind: 'error'; message: string; submittedPrompt: string };

interface ResolveTimeRequestOptions {
  gateway: Pick<
    CalendarEventGateway,
    'findOpenings' | 'getPermission' | 'listEvents' | 'matchEvents'
  >;
  now?: Date;
  onStage?: (stage: 'checkingSchedule') => void;
  // Only the user's text is sent to the cloud; the calendar is read on-device.
  parse: (input: { transcript: string }) => Promise<{ block: TimeBlock }>;
  prompt: string;
  taskBusyIntervals: TaskBusyInterval[];
}

function formatEventLine(event: CalendarEventSummary) {
  const day = new Date(event.startDate).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    weekday: 'short',
  });
  const when = event.isAllDay
    ? 'All day'
    : `${formatClockTime(event.startDate)} – ${formatClockTime(event.endDate)}`;
  return `${day}, ${when}  ${event.title}`;
}

export function formatScheduleAnswer(events: CalendarEventSummary[]) {
  return events.length > 0 ? events.map(formatEventLine).join('\n') : 'Nothing is scheduled then.';
}

function toDraft(block: TimeBlock, submittedPrompt: string): CalendarDraft | null {
  if (!block.start_time) {
    return null;
  }
  const end =
    block.end_time ??
    new Date(
      new Date(block.start_time).getTime() + (block.duration ?? DEFAULT_EVENT_MINUTES) * 60_000,
    ).toISOString();
  return {
    endDate: end,
    isAllDay: false,
    location: block.location,
    notes: null,
    recurrenceRule: block.recurrence_rule,
    startDate: block.start_time,
    title: block.title ?? submittedPrompt,
  };
}

export async function resolveTimeRequest({
  gateway,
  now = new Date(),
  onStage,
  parse,
  prompt,
  taskBusyIntervals,
}: ResolveTimeRequestOptions): Promise<RequestResult> {
  const submittedPrompt = prompt.trim();
  const fail = (message: string): RequestResult => ({ kind: 'error', message, submittedPrompt });
  const permissionMessage = (permission: CalendarPermissionStatus, message: string) =>
    permission === 'authorized' ? null : message;

  try {
    const { block } = await parse({ transcript: submittedPrompt });
    const intent = block.primary_intent;

    if (intent === 'add_task') {
      return { block, kind: 'draft', submittedPrompt };
    }

    onStage?.('checkingSchedule');
    const denied = permissionMessage(
      await gateway.getPermission(),
      'Connect your iOS Calendar to use your schedule.',
    );
    if (denied) {
      return fail(denied);
    }

    if (intent === 'search') {
      const range = getAvailabilityRange(block, now);
      const events = await gateway.listEvents(range.start.toISOString(), range.end.toISOString());
      return { answer: formatScheduleAnswer(events), kind: 'answer' };
    }

    if (intent === 'edit_event' || intent === 'cancel_event') {
      const candidates = block.target_title
        ? await gateway.matchEvents(
            block.target_title,
            now.toISOString(),
            new Date(now.getTime() + UPCOMING_EVENT_DAYS * DAY_MS).toISOString(),
          )
        : [];
      if (candidates.length === 0) {
        return fail('I could not find that upcoming calendar event.');
      }
      return candidates.length === 1
        ? { event: candidates[0], kind: 'open-event' }
        : { candidates, kind: 'event-choice', submittedPrompt };
    }

    const draft =
      intent === 'add_event' || intent === 'add_recurring_event'
        ? toDraft(block, submittedPrompt)
        : null;
    if (draft) {
      return { draft, kind: 'present-draft', submittedPrompt };
    }

    // add_event without a start time, and schedule_gap_fill: offer open slots.
    const range = getAvailabilityRange(block, now);
    const openings = await gateway.findOpenings(
      range.start.toISOString(),
      range.end.toISOString(),
      block.duration ??
        (intent === 'schedule_gap_fill' ? DEFAULT_GAP_MINUTES : DEFAULT_EVENT_MINUTES),
      taskBusyIntervals,
    );
    return openings.length > 0
      ? {
          block,
          kind: 'availability',
          openings: openings.map(({ endDate, startDate }) => ({ end: endDate, start: startDate })),
          submittedPrompt,
        }
      : fail('No opening fits that request in the selected time range.');
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Unable to interpret that time request.');
  }
}
