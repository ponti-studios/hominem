import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveTimeRequest } from '~/components/time/time-request';
import type { TimeBlock } from '~/components/time/time-types';
import type { CalendarEvent } from '~/modules/on-device-ai';

const event = (overrides: Partial<CalendarEvent> = {}): CalendarEvent => ({
  calendarTitle: 'Work',
  endDate: '2026-08-10T11:00:00.000Z',
  id: 'event-1',
  isAllDay: false,
  isEditable: true,
  location: null,
  notes: null,
  participants: [],
  recurrenceDescription: null,
  startDate: '2026-08-10T10:00:00.000Z',
  title: 'Planning',
  ...overrides,
});

const timeBlock = (overrides: Partial<TimeBlock> = {}): TimeBlock => ({
  primary_intent: 'search',
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
  ...overrides,
});

const makeGateway = (permission: 'authorized' | 'denied' = 'authorized') => ({
  findOpenings: vi.fn(async (_start: string, _end: string, _minutes: number) => [
    { endDate: '2026-08-10T10:30:00.000Z', startDate: '2026-08-10T10:00:00.000Z' },
  ]),
  getPermission: vi.fn(async () => permission),
  listEvents: vi.fn(async () => [event()]),
  matchEvents: vi.fn(async () => [event()]),
});

const run = (block: TimeBlock, gateway = makeGateway(), prompt = 'a request') =>
  resolveTimeRequest({
    gateway,
    now: new Date('2026-08-10T09:00:00.000Z'),
    parse: vi.fn(async () => ({ block })),
    prompt,
    taskBusyIntervals: [
      { endDate: '2026-08-10T12:00:00.000Z', startDate: '2026-08-10T11:00:00.000Z' },
    ],
  });

describe('resolveTimeRequest', () => {
  beforeEach(() => vi.useFakeTimers({ now: new Date('2026-08-10T09:00:00.000Z') }));
  afterEach(() => vi.useRealTimers());

  it('sends only the trimmed request text to the parser', async () => {
    const parse = vi.fn(async () => ({ block: timeBlock({ primary_intent: 'add_task' }) }));
    await resolveTimeRequest({
      gateway: makeGateway(),
      parse,
      prompt: '  Buy milk  ',
      taskBusyIntervals: [],
    });

    expect(parse).toHaveBeenCalledWith({ transcript: 'Buy milk' });
  });

  it('returns a task draft without touching the calendar', async () => {
    const gateway = makeGateway('denied');
    const block = timeBlock({ primary_intent: 'add_task', title: 'Write brief' });

    expect(await run(block, gateway, 'Remind me to write brief')).toEqual({
      block,
      kind: 'draft',
      submittedPrompt: 'Remind me to write brief',
    });
    expect(gateway.getPermission).not.toHaveBeenCalled();
  });

  it('answers a search from on-device events', async () => {
    const gateway = makeGateway();
    const result = await run(timeBlock({ primary_intent: 'search' }), gateway);

    expect(result).toMatchObject({ kind: 'answer', answer: expect.stringContaining('Planning') });
    expect(gateway.listEvents).toHaveBeenCalledWith(
      '2026-08-10T09:00:00.000Z',
      '2026-08-17T09:00:00.000Z',
    );
  });

  it('asks for calendar access before reading the schedule', async () => {
    const gateway = makeGateway('denied');

    expect(
      await run(timeBlock({ primary_intent: 'search' }), gateway, 'Find my next meeting'),
    ).toEqual({
      kind: 'error',
      message: 'Connect your iOS Calendar to use your schedule.',
      submittedPrompt: 'Find my next meeting',
    });
    expect(gateway.listEvents).not.toHaveBeenCalled();
  });

  it('finds open time natively for a gap-fill request, passing task busy intervals', async () => {
    const gateway = makeGateway();
    const block = timeBlock({
      duration: 45,
      primary_intent: 'schedule_gap_fill',
      scheduling_window_end: '2026-08-11T00:00:00.000Z',
      scheduling_window_start: '2026-08-10T00:00:00.000Z',
    });

    expect(await run(block, gateway, 'When can I meet Alex?')).toEqual({
      block,
      kind: 'availability',
      openings: [{ end: '2026-08-10T10:30:00.000Z', start: '2026-08-10T10:00:00.000Z' }],
      submittedPrompt: 'When can I meet Alex?',
    });
    expect(gateway.findOpenings).toHaveBeenCalledWith(
      '2026-08-10T00:00:00.000Z',
      '2026-08-11T00:00:00.000Z',
      45,
      [{ endDate: '2026-08-10T12:00:00.000Z', startDate: '2026-08-10T11:00:00.000Z' }],
    );
  });

  it('reports when no opening fits', async () => {
    const gateway = makeGateway();
    gateway.findOpenings.mockResolvedValueOnce([]);

    expect(await run(timeBlock({ primary_intent: 'schedule_gap_fill' }), gateway)).toMatchObject({
      kind: 'error',
      message: 'No opening fits that request in the selected time range.',
    });
  });

  it('opens a unique event matched on-device by title for an edit', async () => {
    const gateway = makeGateway();
    const matching = event();
    gateway.matchEvents.mockResolvedValueOnce([matching]);

    expect(
      await run(timeBlock({ primary_intent: 'edit_event', target_title: 'Planning' }), gateway),
    ).toEqual({ event: matching, kind: 'open-event' });
    expect(gateway.matchEvents).toHaveBeenCalledWith(
      'Planning',
      '2026-08-10T09:00:00.000Z',
      '2026-11-08T09:00:00.000Z',
    );
  });

  it('keeps multiple matching events available for selection', async () => {
    const gateway = makeGateway();
    const first = event();
    const second = event({ id: 'event-2', startDate: '2026-08-11T10:00:00.000Z' });
    gateway.matchEvents.mockResolvedValueOnce([first, second]);

    expect(
      await run(
        timeBlock({ primary_intent: 'cancel_event', target_title: 'Planning' }),
        gateway,
        'Cancel planning',
      ),
    ).toEqual({
      candidates: [first, second],
      kind: 'event-choice',
      submittedPrompt: 'Cancel planning',
    });
  });

  it('reports a missing event without matching when no title was extracted', async () => {
    const gateway = makeGateway();

    expect(await run(timeBlock({ primary_intent: 'cancel_event' }), gateway)).toMatchObject({
      kind: 'error',
      message: 'I could not find that upcoming calendar event.',
    });
    expect(gateway.matchEvents).not.toHaveBeenCalled();
  });

  it('presents a native draft for a fixed event, carrying the recurrence rule', async () => {
    const block = timeBlock({
      end_time: '2026-08-17T10:00:00.000Z',
      location: 'Studio',
      primary_intent: 'add_recurring_event',
      recurrence_rule: 'FREQ=WEEKLY;BYDAY=MO',
      start_time: '2026-08-17T09:00:00.000Z',
      title: 'Team sync',
    });

    expect(await run(block, makeGateway(), 'Team sync every Monday at 9')).toEqual({
      draft: {
        endDate: '2026-08-17T10:00:00.000Z',
        isAllDay: false,
        location: 'Studio',
        notes: null,
        recurrenceRule: 'FREQ=WEEKLY;BYDAY=MO',
        startDate: '2026-08-17T09:00:00.000Z',
        title: 'Team sync',
      },
      kind: 'present-draft',
      submittedPrompt: 'Team sync every Monday at 9',
    });
  });

  it('offers open slots for an event with no start time', async () => {
    const gateway = makeGateway();
    const block = timeBlock({ duration: 90, primary_intent: 'add_event', title: 'Design review' });

    expect(await run(block, gateway)).toMatchObject({ kind: 'availability' });
    expect(gateway.findOpenings.mock.calls[0]?.[2]).toBe(90);
  });

  it('turns a parser failure into an error that preserves the prompt', async () => {
    const result = await resolveTimeRequest({
      gateway: makeGateway(),
      parse: vi.fn(async () => {
        throw new Error('Time block extraction failed');
      }),
      prompt: 'Schedule lunch',
      taskBusyIntervals: [],
    });

    expect(result).toEqual({
      kind: 'error',
      message: 'Time block extraction failed',
      submittedPrompt: 'Schedule lunch',
    });
  });
});
