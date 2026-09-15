import { describe, expect, it } from 'vitest';

import { toLocalInputValue } from './use-task-form-draft';
import { mapParsedBlockToDraftPatch } from './use-task-when-parser';

const base = {
  primary_intent: 'add_task' as const,
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
};

describe('mapParsedBlockToDraftPatch', () => {
  it('maps a complete scheduled block and clears due', () => {
    const start = '2026-09-15T14:00:00-07:00';
    const end = '2026-09-15T15:00:00-07:00';
    const result = mapParsedBlockToDraftPatch({
      ...base,
      start_time: start,
      end_time: end,
      duration: 60,
    });
    expect(result.patch).toMatchObject({
      scheduledStartAt: toLocalInputValue(start),
      scheduledEndAt: toLocalInputValue(end),
      durationMinutes: '60',
      dueAt: '',
    });
  });

  it('derives the end from a start and duration', () => {
    const start = '2026-09-15T14:00:00-07:00';
    const result = mapParsedBlockToDraftPatch({ ...base, start_time: start, duration: 30 });
    expect(result.patch.durationMinutes).toBe('30');
    expect(result.patch.scheduledEndAt).toBe(
      toLocalInputValue(new Date(new Date(start).getTime() + 30 * 60000).toISOString()),
    );
  });

  it('treats a start without duration as a due moment', () => {
    const start = '2026-09-15T14:00:00-07:00';
    const result = mapParsedBlockToDraftPatch({ ...base, start_time: start });
    expect(result.patch.dueAt).toBe(toLocalInputValue(start));
    expect(result.patch.scheduledStartAt).toBeUndefined();
  });

  it('maps a fixed deadline to local midnight', () => {
    expect(mapParsedBlockToDraftPatch({ ...base, deadline_fixed: '2026-09-18' }).patch.dueAt).toBe(
      '2026-09-18T00:00',
    );
  });

  it('maps a duration-only block without inventing a schedule', () => {
    expect(mapParsedBlockToDraftPatch({ ...base, duration: 120 }).patch).toEqual({
      durationMinutes: '120',
    });
  });

  it('reports a vague scheduling window without committing a time', () => {
    const windowStart = '2026-09-21T00:00:00-07:00';
    const result = mapParsedBlockToDraftPatch({
      ...base,
      scheduling_window_start: windowStart,
      scheduling_window_end: '2026-09-28T00:00:00-07:00',
    });
    expect(result.patch).toEqual({});
    expect(result.note).toContain(toLocalInputValue(windowStart).slice(0, 10));
  });

  it('keeps a location even when no time was found', () => {
    const result = mapParsedBlockToDraftPatch({ ...base, location: 'Studio' });
    expect(result.patch).toEqual({ location: 'Studio' });
    expect(result.note).toBeNull();
  });

  it('returns a neutral note for an empty result', () => {
    expect(mapParsedBlockToDraftPatch(base).note).toContain("Didn't find");
  });
});
