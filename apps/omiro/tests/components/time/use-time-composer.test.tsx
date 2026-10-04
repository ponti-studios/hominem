// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderHookWithQueryClient } from '../../utils/render-hook';

const parse = vi.fn();
const presentDraft = vi.fn().mockResolvedValue('saved');
const findOpenings = vi.fn();

vi.mock('expo-crypto', () => ({ randomUUID: () => 'test-request-token' }));
vi.mock('expo-router', () => ({ useIsFocused: () => true }));
vi.mock('~/services/calendar/calendar-event-gateway', () => ({
  calendarEventGateway: {
    findOpenings,
    getPermission: vi.fn(async () => 'authorized'),
    listEvents: vi.fn(async () => []),
    matchEvents: vi.fn(async () => []),
    presentDraft,
  },
}));
vi.mock('~/services/tasks/use-task-create', () => ({
  useTaskCreate: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));
vi.mock('~/services/tasks/use-tasks-query', () => ({ useTasksQuery: () => ({ data: [] }) }));
vi.mock('~/services/tasks/use-time-block-parse', () => ({
  useTimeBlockParse: () => ({ mutateAsync: parse }),
}));

const { useTimeComposer } = await import('~/components/time/use-time-composer');

const block = (overrides: Record<string, unknown> = {}) => ({
  block: {
    deadline_fixed: null,
    duration: null,
    end_time: null,
    location: null,
    participants: null,
    primary_intent: 'add_task',
    recurrence_rule: null,
    scheduling_window_end: null,
    scheduling_window_start: null,
    start_time: null,
    target_title: null,
    title: null,
    ...overrides,
  },
});

describe('useTimeComposer', () => {
  afterEach(() => vi.clearAllMocks());

  it('parses in the cloud with only the prompt and shows a task draft', async () => {
    parse.mockResolvedValueOnce(block({ duration: 30, title: 'Buy milk' }));
    const { result } = renderHookWithQueryClient(() =>
      useTimeComposer({ onError: vi.fn(), onOpenEvent: vi.fn() }),
    );

    act(() => result.current.setPrompt('Buy milk'));
    await act(async () => result.current.ask());

    expect(parse).toHaveBeenCalledWith({ transcript: 'Buy milk' });
    expect(result.current.interaction).toMatchObject({
      block: expect.objectContaining({
        duration: 30,
        primary_intent: 'add_task',
        title: 'Buy milk',
      }),
      kind: 'draft',
    });
    expect(result.current.prompt).toBe('');
  });

  it('keeps a parse failure visible and restores the prompt until cancelled', async () => {
    parse.mockRejectedValueOnce(new Error('Time block extraction failed'));
    const onError = vi.fn();
    const { result } = renderHookWithQueryClient(() =>
      useTimeComposer({ onError, onOpenEvent: vi.fn() }),
    );

    act(() => result.current.setPrompt('Schedule lunch'));
    await act(async () => result.current.ask());

    expect(onError).toHaveBeenCalledWith('Time block extraction failed');
    expect(result.current.interaction).toEqual({
      kind: 'error',
      message: 'Time block extraction failed',
      submittedPrompt: 'Schedule lunch',
    });
    act(() => result.current.cancelResult());
    expect(result.current).toMatchObject({
      interaction: { kind: 'idle' },
      prompt: 'Schedule lunch',
    });
  });

  it('opens the selected availability as a native calendar draft', async () => {
    parse.mockResolvedValueOnce(block({ duration: 60, primary_intent: 'schedule_gap_fill' }));
    findOpenings.mockResolvedValueOnce([
      { endDate: '2026-09-15T11:00:00.000Z', startDate: '2026-09-15T10:00:00.000Z' },
    ]);
    const { result } = renderHookWithQueryClient(() =>
      useTimeComposer({ onError: vi.fn(), onOpenEvent: vi.fn() }),
    );

    act(() => result.current.setPrompt('Find an hour tomorrow'));
    await act(async () => result.current.ask());
    expect(result.current.interaction).toMatchObject({
      kind: 'availability',
      openings: [{ end: '2026-09-15T11:00:00.000Z', start: '2026-09-15T10:00:00.000Z' }],
    });
    await act(async () =>
      result.current.chooseOpening({
        end: '2026-09-15T11:00:00.000Z',
        start: '2026-09-15T10:00:00.000Z',
      }),
    );

    expect(presentDraft).toHaveBeenCalledWith({
      endDate: '2026-09-15T11:00:00.000Z',
      isAllDay: false,
      location: null,
      notes: null,
      recurrenceRule: null,
      startDate: '2026-09-15T10:00:00.000Z',
      title: 'Find an hour tomorrow',
    });
    expect(result.current.interaction).toEqual({ kind: 'idle' });
  });

  it('carries the extracted location and recurrence into the selected opening and restores the prompt on cancel', async () => {
    parse.mockResolvedValueOnce(
      block({
        duration: 90,
        location: 'the office',
        primary_intent: 'add_event',
        recurrence_rule: 'FREQ=WEEKLY;BYDAY=MO',
        title: 'Meeting with Jordan',
      }),
    );
    findOpenings.mockResolvedValueOnce([
      { endDate: '2026-09-15T11:30:00.000Z', startDate: '2026-09-15T10:00:00.000Z' },
    ]);
    presentDraft.mockResolvedValueOnce('cancelled');
    const { result } = renderHookWithQueryClient(() =>
      useTimeComposer({ onError: vi.fn(), onOpenEvent: vi.fn() }),
    );

    act(() => result.current.setPrompt('Schedule 90 minutes with Jordan at the office'));
    await act(async () => result.current.ask());
    await act(async () =>
      result.current.chooseOpening({
        end: '2026-09-15T11:30:00.000Z',
        start: '2026-09-15T10:00:00.000Z',
      }),
    );

    expect(presentDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        location: 'the office',
        recurrenceRule: 'FREQ=WEEKLY;BYDAY=MO',
      }),
    );
    expect(result.current.prompt).toBe('Schedule 90 minutes with Jordan at the office');
  });

  it('presents a fixed event in the native editor and keeps the prompt if it is cancelled', async () => {
    parse.mockResolvedValueOnce(
      block({
        end_time: '2026-09-16T09:00:00.000Z',
        primary_intent: 'add_event',
        start_time: '2026-09-16T08:00:00.000Z',
        title: 'Coffee with Priya',
      }),
    );
    presentDraft.mockResolvedValueOnce('cancelled');
    const { result } = renderHookWithQueryClient(() =>
      useTimeComposer({ onError: vi.fn(), onOpenEvent: vi.fn() }),
    );

    act(() => result.current.setPrompt('Coffee with Priya Wednesday at 8'));
    await act(async () => result.current.ask());

    expect(presentDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        startDate: '2026-09-16T08:00:00.000Z',
        title: 'Coffee with Priya',
      }),
    );
    expect(result.current.interaction).toEqual({ kind: 'idle' });
    expect(result.current.prompt).toBe('Coffee with Priya Wednesday at 8');
  });
});
