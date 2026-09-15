// @vitest-environment jsdom
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderHookWithQueryClient } from '../../utils/render-hook';

const interpret = vi.fn();

vi.mock('expo-router', () => ({ useIsFocused: () => true }));
vi.mock('~/services/calendar/calendar-event-gateway', () => ({
  calendarEventGateway: { interpret },
}));
vi.mock('~/services/tasks/use-task-create', () => ({
  useTaskCreate: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));
vi.mock('~/services/tasks/use-tasks-query', () => ({ useTasksQuery: () => ({ data: [] }) }));

const { useTimeComposer } = await import('~/components/time/use-time-composer');

describe('useTimeComposer', () => {
  afterEach(() => vi.clearAllMocks());

  it('sends only the prompt and task busy intervals to the native assistant', async () => {
    interpret.mockResolvedValueOnce({
      kind: 'taskDraft',
      taskDueAt: null,
      taskDurationMinutes: 30,
      taskLocation: null,
      taskScheduledEndAt: null,
      taskScheduledStartAt: null,
      taskSchedulingWindowEndAt: null,
      taskSchedulingWindowStartAt: null,
      taskTitle: 'Buy milk',
    });
    const { result } = renderHookWithQueryClient(() =>
      useTimeComposer({ onError: vi.fn(), onOpenEvent: vi.fn() }),
    );

    act(() => result.current.setPrompt('Buy milk'));
    await act(async () => result.current.ask());

    expect(interpret).toHaveBeenCalledWith('Buy milk', []);
    expect(result.current.interaction).toMatchObject({
      block: expect.objectContaining({
        duration: 30,
        primary_intent: 'add_task',
        title: 'Buy milk',
      }),
      kind: 'draft',
    });
  });

  it('keeps an unavailable native-assistant message visible until cancelled', async () => {
    interpret.mockResolvedValueOnce({ error: 'Apple Intelligence is unavailable.', kind: 'error' });
    const onError = vi.fn();
    const { result } = renderHookWithQueryClient(() =>
      useTimeComposer({ onError, onOpenEvent: vi.fn() }),
    );

    act(() => result.current.setPrompt('Schedule lunch'));
    await act(async () => result.current.ask());

    expect(onError).toHaveBeenCalledWith('Apple Intelligence is unavailable.');
    expect(result.current.interaction).toEqual({
      kind: 'error',
      message: 'Apple Intelligence is unavailable.',
      submittedPrompt: 'Schedule lunch',
    });
    act(() => result.current.cancelResult());
    expect(result.current).toMatchObject({
      interaction: { kind: 'idle' },
      prompt: 'Schedule lunch',
    });
  });

  it('turns an availability choice into a database-backed task draft', async () => {
    interpret.mockResolvedValueOnce({
      availability: [
        { endDate: '2026-09-15T11:00:00.000Z', startDate: '2026-09-15T10:00:00.000Z' },
      ],
      kind: 'availability',
    });
    const { result } = renderHookWithQueryClient(() =>
      useTimeComposer({ onError: vi.fn(), onOpenEvent: vi.fn() }),
    );

    act(() => result.current.setPrompt('Find an hour tomorrow'));
    await act(async () => result.current.ask());
    act(() =>
      result.current.chooseOpening({
        end: '2026-09-15T11:00:00.000Z',
        start: '2026-09-15T10:00:00.000Z',
      }),
    );

    expect(result.current.interaction).toMatchObject({
      block: expect.objectContaining({ primary_intent: 'add_task' }),
      kind: 'draft',
    });
  });
});
