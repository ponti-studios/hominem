import { randomUUID } from 'expo-crypto';
import { useCallback, useRef, useState } from 'react';

import type { CalendarEvent } from '~/modules/on-device-ai';
import { calendarEventGateway } from '~/services/calendar/calendar-event-gateway';
import { useTaskCreate } from '~/services/tasks/use-task-create';
import { useTasksQuery } from '~/services/tasks/use-tasks-query';
import { useTimeBlockParse } from '~/services/tasks/use-time-block-parse';

import { resolveTimeRequest } from './time-request';
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
  const parseTimeBlock = useTimeBlockParse();
  const isSaving = createTask.isPending;

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
        const result = await resolveTimeRequest({
          gateway: calendarEventGateway,
          onStage: (stage) => {
            if (requestTokenRef.current === requestToken) {
              setProcessingStage(stage);
            }
          },
          parse: parseTimeBlock.mutateAsync,
          prompt: submittedPrompt,
          taskBusyIntervals: tasks.flatMap((task) =>
            task.startAt && task.dueAt ? [{ startDate: task.startAt, endDate: task.dueAt }] : [],
          ),
        });
        if (requestTokenRef.current !== requestToken) {
          return;
        }
        switch (result.kind) {
          case 'answer':
            setPrompt('');
            setInteraction({ answer: result.answer, kind: 'answer' });
            return;
          case 'availability':
          case 'draft':
          case 'event-choice':
            setPrompt('');
            setInteraction(result);
            return;
          case 'open-event':
            setPrompt('');
            setInteraction({ kind: 'idle' });
            onOpenEvent(result.event);
            return;
          case 'present-draft': {
            setInteraction({ kind: 'idle' });
            const editorResult = await calendarEventGateway.presentDraft(result.draft);
            setPrompt(editorResult === 'saved' ? '' : submittedPrompt);
            return;
          }
          case 'error':
            fail(result.message, submittedPrompt);
        }
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
    [fail, interaction.kind, isSaving, onOpenEvent, parseTimeBlock.mutateAsync, tasks],
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
    setPrompt(interaction.submittedPrompt);
    setInteraction({ kind: 'idle' });
  }, [interaction]);

  const reset = useCallback(() => {
    requestTokenRef.current = null;
    setPrompt('');
    setProcessingStage('understanding');
    setInteraction({ kind: 'idle' });
  }, []);

  const chooseOpening = useCallback(
    async (opening: TimeOpening) => {
      if (interaction.kind !== 'availability') {
        return;
      }
      const { block, submittedPrompt } = interaction;
      setInteraction({ kind: 'idle' });
      try {
        const editorResult = await calendarEventGateway.presentDraft({
          endDate: opening.end,
          isAllDay: false,
          location: block.location,
          notes: null,
          recurrenceRule: block.recurrence_rule,
          startDate: opening.start,
          title: block.title ?? submittedPrompt,
        });
        setPrompt(editorResult === 'saved' ? '' : submittedPrompt);
      } catch (error) {
        fail(
          error instanceof Error ? error.message : 'Unable to open a calendar draft.',
          submittedPrompt,
        );
      }
    },
    [fail, interaction],
  );

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
        dueAt: block.end_time
          ? block.end_time
          : block.deadline_fixed
            ? new Date(`${block.deadline_fixed}T23:59:59`).toISOString()
            : null,
        location: block.location,
        startAt: block.start_time,
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
