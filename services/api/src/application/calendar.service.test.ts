import { describe, expect, it, vi } from 'vitest';

const repositories = vi.hoisted(() => ({
  calendarGetOccurrence: vi.fn(),
  calendarSearch: vi.fn(),
  calendarUpcoming: vi.fn(),
}));

const errors = vi.hoisted(() => {
  class NotFoundError extends Error {
    readonly code = 'NOT_FOUND';
    readonly statusCode = 404;

    constructor(resource: string) {
      super(`${resource} not found`);
    }
  }

  return { NotFoundError };
});

vi.mock('@hominem/db', () => ({
  CalendarQueryRepository: {
    getOccurrence: repositories.calendarGetOccurrence,
    search: repositories.calendarSearch,
    upcoming: repositories.calendarUpcoming,
  },
  NotFoundError: errors.NotFoundError,
}));

import { CalendarService } from './calendar.service';

const userId = '11111111-1111-4111-8111-111111111111';

const occurrence = {
  occurrenceId: '22222222-2222-4222-8222-222222222222',
  eventId: '33333333-3333-4333-8333-333333333333',
  title: 'Flight to Nashville',
  startsAt: '2026-03-12T15:00:00.000Z',
  endsAt: '2026-03-12T17:00:00.000Z',
  occurrenceDate: null,
  isAllDay: false,
  location: 'BNA',
  isCancelled: false,
  evidence: {
    sourceRecordId: '44444444-4444-4444-8444-444444444444',
    sourceSystem: 'calendar-fixture',
    sourceFile: 'march-trip.ics',
    importRunId: '55555555-5555-4555-8555-555555555555',
    importedAt: '2026-07-10T10:00:00.000Z',
  },
};

describe('CalendarService', () => {
  it('loads one occurrence detail through the metadata-only DTO', async () => {
    repositories.calendarGetOccurrence.mockResolvedValueOnce(occurrence);
    const service = new CalendarService();

    const result = await service.getOccurrence(userId, occurrence.occurrenceId);

    expect(repositories.calendarGetOccurrence).toHaveBeenCalledWith(userId, occurrence.occurrenceId);
    expect(result).toEqual(occurrence);
  });

  it('returns a stable not-found error for missing occurrence detail', async () => {
    repositories.calendarGetOccurrence.mockResolvedValueOnce(null);
    const service = new CalendarService();

    await expect(service.getOccurrence(userId, occurrence.occurrenceId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404,
    });
  });

  it('returns metadata-only search results with evidence', async () => {
    repositories.calendarSearch.mockResolvedValueOnce([occurrence]);
    const service = new CalendarService();

    const results = await service.search(userId, {
      query: 'Nashville',
      startsFrom: '2026-03-01T00:00:00.000Z',
      startsBefore: '2026-04-01T00:00:00.000Z',
      includeCancelled: false,
      limit: 25,
    });

    expect(repositories.calendarSearch).toHaveBeenCalledWith(userId, {
      query: 'Nashville',
      startsFrom: '2026-03-01T00:00:00.000Z',
      startsBefore: '2026-04-01T00:00:00.000Z',
      includeCancelled: false,
      limit: 25,
    });
    expect(results).toEqual([occurrence]);
    expect(JSON.stringify(results)).not.toContain('description');
    expect(JSON.stringify(results)).not.toContain('/raw/calendar/');
  });

  it('preserves all-day date semantics separately from timed starts', async () => {
    repositories.calendarUpcoming.mockResolvedValueOnce([
      {
        ...occurrence,
        startsAt: '2026-03-17T00:00:00.000Z',
        endsAt: null,
        occurrenceDate: '2026-03-17',
        isAllDay: true,
      },
    ]);
    const service = new CalendarService();

    const results = await service.upcoming(userId, {
      startsFrom: '2026-03-01T00:00:00.000Z',
      startsBefore: '2026-04-01T00:00:00.000Z',
      limit: 10,
    });

    expect(results[0]).toMatchObject({
      startsAt: '2026-03-17T00:00:00.000Z',
      occurrenceDate: '2026-03-17',
      isAllDay: true,
    });
  });

  it('rejects repository rows that would leak invalid calendar DTOs', async () => {
    repositories.calendarSearch.mockResolvedValueOnce([{ ...occurrence, title: 123 }]);
    const service = new CalendarService();

    await expect(
      service.search(userId, { query: 'bad', includeCancelled: false, limit: 25 }),
    ).rejects.toThrow();
  });
});
