import { describe, expect, it, vi } from 'vitest';

const repositories = vi.hoisted(() => ({
  calendarSearch: vi.fn(),
  calendarUpcoming: vi.fn(),
  financeMonthlySummary: vi.fn(),
  getPersonalDataHealth: vi.fn(),
}));

const errors = vi.hoisted(() => {
  class ValidationError extends Error {
    readonly code = 'VALIDATION_ERROR';
    readonly statusCode = 400;
  }

  return { ValidationError };
});

vi.mock('@hominem/db', () => ({
  CalendarQueryRepository: {
    search: repositories.calendarSearch,
    upcoming: repositories.calendarUpcoming,
  },
  FinanceQueryRepository: {
    monthlySummary: repositories.financeMonthlySummary,
  },
  ImportHealthRepository: {
    getPersonalDataHealth: repositories.getPersonalDataHealth,
  },
  ValidationError: errors.ValidationError,
}));

import { callPersonalMcpTool, listPersonalMcpTools } from './personal-tools';

const userId = '11111111-1111-4111-8111-111111111111';

describe('personal MCP tool registry', () => {
  it('lists only read-only personal capability tools', () => {
    const tools = listPersonalMcpTools();

    expect(tools.map((tool) => tool.name)).toEqual([
      'personal_calendar_search',
      'personal_calendar_upcoming',
      'personal_finance_monthly_summary',
      'personal_data_health',
    ]);
    expect(tools.every((tool) => tool.readOnly)).toBe(true);
    expect(tools.flatMap((tool) => [...tool.scopes])).toEqual([
      'calendar:read',
      'calendar:read',
      'finance:read',
      'provenance:read',
    ]);
  });

  it('invokes calendar search and returns MCP-style text plus structured content', async () => {
    repositories.calendarSearch.mockResolvedValueOnce([
      {
        occurrenceId: '22222222-2222-4222-8222-222222222222',
        eventId: '33333333-3333-4333-8333-333333333333',
        title: 'Dinner in Nashville',
        startsAt: '2026-03-12T18:00:00.000Z',
        endsAt: '2026-03-12T20:00:00.000Z',
        occurrenceDate: null,
        isAllDay: false,
        location: 'Nashville',
        isCancelled: false,
        evidence: {
          sourceRecordId: '44444444-4444-4444-8444-444444444444',
          sourceSystem: 'warehouse',
          sourceFile: 'march-trip.ics',
          importRunId: '55555555-5555-4555-8555-555555555555',
          importedAt: '2026-07-10T10:00:00.000Z',
        },
      },
    ]);

    const result = await callPersonalMcpTool(userId, 'personal_calendar_search', {
      query: 'Nashville',
      startsFrom: '2026-03-01T00:00:00.000Z',
      startsBefore: '2026-04-01T00:00:00.000Z',
    });

    expect(repositories.calendarSearch).toHaveBeenCalledWith(userId, {
      query: 'Nashville',
      startsFrom: '2026-03-01T00:00:00.000Z',
      startsBefore: '2026-04-01T00:00:00.000Z',
      includeCancelled: false,
      limit: 25,
    });
    expect(result.structuredContent).toMatchObject({
      events: [
        {
          title: 'Dinner in Nashville',
          evidence: { sourceFile: 'march-trip.ics' },
        },
      ],
    });
    expect(JSON.parse(result.content[0]?.text ?? '{}')).toEqual(result.structuredContent);
  });

  it('rejects invalid tool input before calling a repository', async () => {
    repositories.financeMonthlySummary.mockClear();

    await expect(
      callPersonalMcpTool(userId, 'personal_finance_monthly_summary', { month: 'March' }),
    ).rejects.toThrow();
    expect(repositories.financeMonthlySummary).not.toHaveBeenCalled();
  });

  it('rejects unknown tool names with a stable validation error', async () => {
    await expect(callPersonalMcpTool(userId, 'raw_sql', {})).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
    });
  });
});
