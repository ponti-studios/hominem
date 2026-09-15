import { useCallback, useState } from 'react';

import type { CalendarEvent, TimeAssistantResult } from '~/modules/on-device-ai';
import { calendarEventGateway } from '~/services/calendar/calendar-event-gateway';
import { localTimeZone } from '~/services/date/format-date';
import { useTaskCreate } from '~/services/tasks/use-task-create';
import { useTasksQuery } from '~/services/tasks/use-tasks-query';

import type { EditableTimeBlockField, TimeInteractionState, TimeOpening } from './time-types';

interface UseTimeComposerOptions {
  onError: (message: string) => void;
  onOpenEvent: (event: CalendarEvent) => void;
}

export function useTimeComposer({ onError, onOpenEvent }: UseTimeComposerOptions) {
  const [prompt, setPrompt] = useState('');
  const [interaction, setInteraction] = useState<TimeInteractionState>({ kind: 'idle' });
  const { data: tasks = [] } = useTasksQuery();
  const createTask = useTaskCreate();
  const isSaving = createTask.isPending;

  const fail = useCallback(
    (message: string, submittedPrompt: string) => {
      setPrompt(submittedPrompt);
      setInteraction({ kind: 'error', message, submittedPrompt });
      onError(message);
    },
    [onError],
  );

  const ask = useCallback(async () => {
    const submittedPrompt = prompt.trim();
    if (!submittedPrompt || interaction.kind === 'parsing' || isSaving) {
      return;
    }

    setInteraction({ kind: 'parsing', submittedPrompt });
    try {
      const result = await calendarEventGateway.interpret(
        submittedPrompt,
        tasks.flatMap((task) =>
          task.scheduledStartAt && task.scheduledEndAt
            ? [{ startDate: task.scheduledStartAt, endDate: task.scheduledEndAt }]
            : [],
        ),
      );
      if (result.kind === 'answer') {
        setPrompt('');
        setInteraction({ answer: result.answer, kind: 'answer' });
        return;
      }
      if (result.kind === 'availability') {
        setPrompt('');
        setInteraction({
          kind: 'availability',
          openings: result.availability.map(({ startDate, endDate }) => ({
            start: startDate,
            end: endDate,
          })),
          block: nativeTimeBlock(result),
          submittedPrompt,
        });
        return;
      }
      if (result.kind === 'taskDraft') {
        setPrompt('');
        setInteraction({ block: nativeTimeBlock(result), kind: 'draft', submittedPrompt });
        return;
      }
      fail(result.kind === 'error' ? result.error : 'Time request was cancelled.', submittedPrompt);
    } catch (error) {
      fail(
        error instanceof Error ? error.message : 'Unable to interpret that time request.',
        submittedPrompt,
      );
    }
  }, [fail, interaction.kind, isSaving, prompt, tasks]);

  const chooseOpening = useCallback((opening: TimeOpening) => {
    setInteraction((current) => {
      if (current.kind !== 'availability') {
        return current;
      }
      return {
        block: {
          ...current.block,
          end_time: opening.end,
          primary_intent: 'add_task',
          start_time: opening.start,
        },
        kind: 'draft',
        submittedPrompt: current.submittedPrompt,
      };
    });
  }, []);

  const chooseEvent = useCallback(
    (id: string) => {
      if (interaction.kind !== 'event-choice') {
        return;
      }
      const event = interaction.candidates.find((candidate) => candidate.id === id);
      if (!event) {
        return;
      }
      onOpenEvent(event);
      setInteraction({ kind: 'idle' });
    },
    [interaction, onOpenEvent],
  );

  const updateDraft = useCallback((field: EditableTimeBlockField, value: string) => {
    setInteraction((current) =>
      current.kind === 'draft'
        ? { ...current, block: { ...current.block, [field]: value || null } }
        : current,
    );
  }, []);

  const submitDraft = useCallback(async () => {
    if (interaction.kind !== 'draft' || isSaving) {
      return;
    }
    const { block, submittedPrompt } = interaction;
    const title = block.title?.trim();
    if (!title) {
      fail('Add a title before saving this time block.', submittedPrompt);
      return;
    }

    try {
      if (block.primary_intent === 'add_task') {
        await createTask.mutateAsync({
          title,
          dueAt: block.deadline_fixed
            ? new Date(`${block.deadline_fixed}T23:59:59`).toISOString()
            : null,
          durationMinutes: block.duration,
          location: block.location,
          scheduledStartAt: block.start_time,
          scheduledEndAt: block.end_time,
          schedulingWindowStartAt: block.scheduling_window_start,
          schedulingWindowEndAt: block.scheduling_window_end,
          timeZone: localTimeZone(),
        });
      } else {
        fail('Review this request before making a change.', submittedPrompt);
        return;
      }
      setInteraction({ kind: 'idle' });
    } catch (error) {
      fail(
        error instanceof Error ? error.message : 'Unable to save this time block.',
        submittedPrompt,
      );
    }
  }, [createTask, fail, interaction, isSaving]);

  const cancelResult = useCallback(() => {
    const submittedPrompt =
      interaction.kind === 'availability' ||
      interaction.kind === 'error' ||
      interaction.kind === 'event-choice'
        ? interaction.submittedPrompt
        : '';
    setPrompt(submittedPrompt);
    setInteraction({ kind: 'idle' });
  }, [interaction]);

  return {
    ask,
    cancelResult,
    chooseEvent,
    chooseOpening,
    interaction,
    isSaving,
    prompt,
    setPrompt,
    submitDraft,
    updateDraft,
  };
}

function nativeTimeBlock(
  result: Extract<TimeAssistantResult, { kind: 'taskDraft' | 'availability' }>,
) {
  const draft = result.kind === 'taskDraft' ? result : null;
  return {
    primary_intent: 'add_task' as const,
    title: draft?.taskTitle ?? null,
    target_title: null,
    participants: null,
    location: draft?.taskLocation ?? null,
    duration: draft?.taskDurationMinutes ?? null,
    start_time: draft?.taskScheduledStartAt ?? null,
    end_time: draft?.taskScheduledEndAt ?? null,
    scheduling_window_start: draft?.taskSchedulingWindowStartAt ?? null,
    scheduling_window_end: draft?.taskSchedulingWindowEndAt ?? null,
    deadline_fixed: draft?.taskDueAt?.slice(0, 10) ?? null,
    recurrence_rule: null,
  };
}
