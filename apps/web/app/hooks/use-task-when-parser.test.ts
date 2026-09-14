import { describe, expect, it } from 'vitest';

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
    const result = mapParsedBlockToDraftPatch({
      ...base,
      start_time: '2026-09-15T14:00:00-07:00',
      end_time: '2026-09-15T15:00:00-07:00',
      duration: 60,
    });
    expect(result.patch).toMatchObject({
      scheduledStartAt: expect.stringContaining('14:00'),
      scheduledEndAt: expect.stringContaining('15:00'),
      durationMinutes: '60',
      dueAt: '',
    });
  });

  it('derives the end from a start and duration', () => {
    const result = mapParsedBlockToDraftPatch({
      ...base,
      start_time: '2026-09-15T14:00:00-07:00',
      duration: 30,
    });
    expect(result.patch.durationMinutes).toBe('30');
    expect(result.patch.scheduledEndAt).toContain('14:30');
  });

  it('treats a start without duration as a due moment', () => {
    const result = mapParsedBlockToDraftPatch({ ...base, start_time: '2026-09-15T14:00:00-07:00' });
    expect(result.patch.dueAt).toContain('14:00');
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
    const result = mapParsedBlockToDraftPatch({
      ...base,
      scheduling_window_start: '2026-09-21T00:00:00-07:00',
      scheduling_window_end: '2026-09-28T00:00:00-07:00',
    });
    expect(result.patch).toEqual({});
    expect(result.note).toContain('Window: 2026-09-21');
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
