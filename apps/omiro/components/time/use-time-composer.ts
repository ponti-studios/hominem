import { randomUUID } from 'expo-crypto';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { CalendarEvent, TimeAssistantResult } from '~/modules/on-device-ai';
import { calendarEventGateway } from '~/services/calendar/calendar-event-gateway';
import { localTimeZone } from '~/services/date/format-date';
import { useTaskCreate } from '~/services/tasks/use-task-create';
import { useTasksQuery } from '~/services/tasks/use-tasks-query';

import type {
  EditableTimeBlockField,
  TimeInteractionState,
  TimeOpening,
  TimeProcessingStage,
} from './time-types';

interface UseTimeComposerOptions {
  onError: (message: string) => void;
  onOpenEvent: (event: CalendarEvent) => void;
}

export function useTimeComposer({ onError, onOpenEvent }: UseTimeComposerOptions) {
  const [prompt, setPrompt] = useState('');
  const [interaction, setInteraction] = useState<TimeInteractionState>({ kind: 'idle' });
  const [processingStage, setProcessingStage] = useState<TimeProcessingStage>('understanding');
  const requestTokenRef = useRef<string | null>(null);
  const { data: tasks = [] } = useTasksQuery();
  const createTask = useTaskCreate();
  const isSaving = createTask.isPending;

  useEffect(() => {
    const subscription = calendarEventGateway.subscribeToProcessingStage((event) => {
      if (event.requestToken === requestTokenRef.current) {
        setProcessingStage(event.stage);
      }
    });
    return () => subscription.remove();
  }, []);

  const fail = useCallback(
    (message: string, submittedPrompt: string) => {
      setPrompt(submittedPrompt);
      setInteraction({ kind: 'error', message, submittedPrompt });
      onError(message);
    },
    [onError],
  );

  const runPrompt = useCallback(
    async (submittedPrompt: string) => {
      if (!submittedPrompt || interaction.kind === 'parsing' || isSaving) {
        return;
      }

      const requestToken = randomUUID();
      requestTokenRef.current = requestToken;
      setProcessingStage('understanding');
      setInteraction({ kind: 'parsing', submittedPrompt });
      try {
        const result = await calendarEventGateway.interpret(
          submittedPrompt,
          tasks.flatMap((task) =>
            task.scheduledStartAt && task.scheduledEndAt
              ? [{ startDate: task.scheduledStartAt, endDate: task.scheduledEndAt }]
              : [],
          ),
          requestToken,
        );
        if (requestTokenRef.current !== requestToken) {
          return;
        }
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
        fail(
          result.kind === 'error' ? result.error : 'Time request was cancelled.',
          submittedPrompt,
        );
      } catch (error) {
        if (requestTokenRef.current !== requestToken) {
          return;
        }
        fail(
          error instanceof Error ? error.message : 'Unable to interpret that time request.',
          submittedPrompt,
        );
      } finally {
        if (requestTokenRef.current === requestToken) {
          requestTokenRef.current = null;
        }
      }
    },
    [fail, interaction.kind, isSaving, tasks],
  );

  const ask = useCallback(() => {
    void runPrompt(prompt.trim());
  }, [prompt, runPrompt]);

  const retry = useCallback(() => {
    if (interaction.kind === 'error') {
      void runPrompt(interaction.submittedPrompt);
    }
  }, [interaction, runPrompt]);

  const cancelProcessing = useCallback(() => {
    const requestToken = requestTokenRef.current;
    if (!requestToken || interaction.kind !== 'parsing') {
      return;
    }
    requestTokenRef.current = null;
    void calendarEventGateway.cancelInterpretation(requestToken);
    setPrompt(interaction.submittedPrompt);
    setInteraction({ kind: 'idle' });
  }, [interaction]);

  const reset = useCallback(() => {
    if (requestTokenRef.current) {
      const requestToken = requestTokenRef.current;
      requestTokenRef.current = null;
      void calendarEventGateway.cancelInterpretation(requestToken);
    }
    setPrompt('');
    setProcessingStage('understanding');
    setInteraction({ kind: 'idle' });
  }, []);

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
      return false;
    }
    const { block, submittedPrompt } = interaction;
    const title = block.title?.trim();
    if (!title) {
      fail('Add a title before saving this task.', submittedPrompt);
      return false;
    }

    try {
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
      setInteraction({ kind: 'idle' });
      return true;
    } catch (error) {
      fail(error instanceof Error ? error.message : 'Unable to save this task.', submittedPrompt);
      return false;
    }
  }, [createTask, fail, interaction, isSaving]);

  const cancelResult = useCallback(() => {
    const submittedPrompt =
      interaction.kind === 'availability' ||
      interaction.kind === 'error' ||
      interaction.kind === 'event-choice' ||
      interaction.kind === 'draft'
        ? interaction.submittedPrompt
        : '';
    setPrompt(submittedPrompt);
    setInteraction({ kind: 'idle' });
  }, [interaction]);

  return {
    ask,
    cancelProcessing,
    cancelResult,
    chooseEvent,
    chooseOpening,
    interaction,
    isSaving,
    processingStage,
    prompt,
    reset,
    retry,
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
