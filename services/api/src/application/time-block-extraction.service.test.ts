import { createStructuredChatCompletion } from '@hominem/ai';
import { describe, expect, it, vi } from 'vitest';

import {
  extractTimeBlock,
  normalizeExplicitWeekday,
  normalizeOffset,
  parseTimeBlockExtractionOutput,
} from './time-block-extraction.service';

vi.mock('@hominem/ai', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@hominem/ai')>()),
  createStructuredChatCompletion: vi.fn(),
}));

describe('extractTimeBlock', () => {
  it("sends the model's reasoning profile so models that cannot disable reasoning are accepted", async () => {
    vi.mocked(createStructuredChatCompletion).mockResolvedValue({
      output: {
        primary_intent: 'add_task',
        title: 'Pay rent',
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
      },
      usage: null,
    } as Awaited<ReturnType<typeof createStructuredChatCompletion>>);

    await extractTimeBlock(
      {
        transcript: 'Pay rent',
        referenceDate: '2026-07-25T11:17:00-07:00',
        model: 'z-ai/glm-5.3-flash',
      },
      'prompt',
    );

    expect(createStructuredChatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'z-ai/glm-5.3-flash', reasoning: { effort: 'low' } }),
      expect.anything(),
    );
  });

  it('gives the model a weekday list so named days resolve to the right dates', async () => {
    await extractTimeBlock(
      {
        transcript: 'Dentist Monday at 3 PM',
        referenceDate: '2026-07-25T11:17:00-07:00',
        timezone: 'America/Los_Angeles',
      },
      'prompt',
    );

    const [request] = vi.mocked(createStructuredChatCompletion).mock.calls.at(-1) ?? [];
    const user = request?.messages.find((message) => message.role === 'user');
    expect(user?.content).toContain(
      'Upcoming days: Saturday 2026-07-25 (today), Sunday 2026-07-26 (tomorrow), Monday 2026-07-27,',
    );
  });
});

describe('parseTimeBlockExtractionOutput', () => {
  it('preserves fixed event fields and explicit participants', () => {
    expect(
      parseTimeBlockExtractionOutput({
        primary_intent: 'add_event',
        title: 'Meeting with Sarah',
        target_title: null,
        participants: ['Sarah'],
        location: null,
        duration: 60,
        start_time: '2026-07-26T10:00:00-07:00',
        end_time: '2026-07-26T11:00:00-07:00',
        scheduling_window_start: null,
        scheduling_window_end: null,
        deadline_fixed: null,
        recurrence_rule: null,
      }),
    ).toMatchObject({
      primary_intent: 'add_event',
      duration: 60,
      start_time: '2026-07-26T10:00:00-07:00',
    });
  });

  it('accepts a flexible task with a resolved scheduling window', () => {
    const block = parseTimeBlockExtractionOutput({
      primary_intent: 'add_task',
      title: 'Write pitch deck',
      target_title: null,
      participants: null,
      location: null,
      duration: 120,
      start_time: null,
      end_time: null,
      scheduling_window_start: '2026-07-26T00:00:00-07:00',
      scheduling_window_end: '2026-07-27T00:00:00-07:00',
      deadline_fixed: null,
      recurrence_rule: null,
    });

    expect(block.start_time).toBeNull();
    expect(block.end_time).toBeNull();
    expect(block.scheduling_window_start).toBe('2026-07-26T00:00:00-07:00');
  });

  it('rejects unknown intents and malformed durations', () => {
    expect(() =>
      parseTimeBlockExtractionOutput({
        primary_intent: 'create_calendar_item',
        title: 'Gym',
        target_title: null,
        participants: null,
        location: null,
        duration: 'one hour',
        start_time: null,
        end_time: null,
        scheduling_window_start: null,
        scheduling_window_end: null,
        deadline_fixed: null,
        recurrence_rule: null,
      }),
    ).toThrow();
  });

  it('accepts edit, cancel, and recurring event metadata', () => {
    const edited = parseTimeBlockExtractionOutput({
      primary_intent: 'edit_event',
      title: 'planning meeting',
      target_title: 'planning meeting',
      participants: null,
      location: null,
      duration: 60,
      start_time: '2026-07-26T16:00:00-07:00',
      end_time: '2026-07-26T17:00:00-07:00',
      scheduling_window_start: null,
      scheduling_window_end: null,
      deadline_fixed: null,
      recurrence_rule: null,
    });
    expect(edited).toMatchObject({
      primary_intent: 'edit_event',
      target_title: 'planning meeting',
    });

    const recurring = parseTimeBlockExtractionOutput({
      primary_intent: 'add_recurring_event',
      title: 'team sync',
      target_title: null,
      participants: null,
      location: null,
      duration: 60,
      start_time: '2026-07-27T09:00:00-07:00',
      end_time: '2026-07-27T10:00:00-07:00',
      scheduling_window_start: null,
      scheduling_window_end: null,
      deadline_fixed: null,
      recurrence_rule: 'FREQ=WEEKLY;BYDAY=MO',
    });
    expect(recurring).toMatchObject({
      primary_intent: 'add_recurring_event',
      recurrence_rule: 'FREQ=WEEKLY;BYDAY=MO',
    });
  });

  it('resolves a corrected weekday from the reference date', () => {
    const block = parseTimeBlockExtractionOutput({
      primary_intent: 'add_event',
      title: null,
      target_title: null,
      participants: null,
      location: null,
      duration: 60,
      start_time: '2026-08-01T14:00:00-07:00',
      end_time: '2026-08-01T15:00:00-07:00',
      scheduling_window_start: null,
      scheduling_window_end: null,
      deadline_fixed: null,
      recurrence_rule: null,
    });

    expect(
      normalizeExplicitWeekday(block, {
        transcript: 'Schedule it tomorrow at 10, actually Friday at 2 PM',
        referenceDate: '2026-07-25T11:17:00-07:00',
        timezone: 'America/Los_Angeles',
      }),
    ).toMatchObject({
      start_time: '2026-07-31T14:00:00-07:00',
      end_time: '2026-07-31T15:00:00-07:00',
    });
  });
});

describe('normalizeOffset', () => {
  const zone = 'America/Los_Angeles';

  it('recomputes the offset for a date after the fall-back change', () => {
    expect(normalizeOffset('2026-11-01T09:00:00-07:00', zone)).toBe('2026-11-01T09:00:00-08:00');
  });

  it('recomputes the offset for a date after the spring-forward change', () => {
    expect(normalizeOffset('2026-03-09T09:00:00-08:00', zone)).toBe('2026-03-09T09:00:00-07:00');
  });

  it('keeps correct offsets and the wall-clock time', () => {
    expect(normalizeOffset('2026-07-26T10:00:00-07:00', zone)).toBe('2026-07-26T10:00:00-07:00');
    expect(normalizeOffset('2026-07-26T00:00:00-07:00', zone)).toBe('2026-07-26T00:00:00-07:00');
  });

  it('converts a UTC value to the same instant in the time zone, including half-hour zones', () => {
    expect(normalizeOffset('2026-07-26T10:00:00Z', 'Asia/Kolkata')).toBe(
      '2026-07-26T15:30:00+05:30',
    );
    expect(normalizeOffset('2026-11-01T17:00:00Z', 'America/Los_Angeles')).toBe(
      '2026-11-01T09:00:00-08:00',
    );
  });

  it('passes through nulls, missing or invalid zones, and unparseable values', () => {
    expect(normalizeOffset(null, zone)).toBeNull();
    expect(normalizeOffset('2026-07-26T10:00:00-07:00', undefined)).toBe(
      '2026-07-26T10:00:00-07:00',
    );
    expect(normalizeOffset('2026-07-26T10:00:00-07:00', 'Not/AZone')).toBe(
      '2026-07-26T10:00:00-07:00',
    );
    expect(normalizeOffset('tomorrow', zone)).toBe('tomorrow');
  });
});
