import { useApiClient } from '@hominem/rpc/react';
import type { TasksParseOutput } from '@hominem/rpc/types';
import { useMutation } from '@tanstack/react-query';

import type { TaskFormPatch } from './use-task-form-draft';
import { toLocalInputValue } from './use-task-form-draft';

type TimeBlock = TasksParseOutput['block'];

export interface ParsedWhenResult {
  patch: TaskFormPatch;
  note: string | null;
}

export function mapParsedBlockToDraftPatch(block: TimeBlock): ParsedWhenResult {
  const location = block.location ?? undefined;
  const base = location ? { location } : {};
  if (block.start_time && block.end_time) {
    return {
      patch: {
        ...base,
        scheduledStartAt: toLocalInputValue(block.start_time),
        scheduledEndAt: toLocalInputValue(block.end_time),
        durationMinutes: String(
          block.duration ??
            Math.round(
              (new Date(block.end_time).getTime() - new Date(block.start_time).getTime()) / 60000,
            ),
        ),
        dueAt: '',
      },
      note: null,
    };
  }
  if (block.start_time && block.duration) {
    const end = new Date(
      new Date(block.start_time).getTime() + block.duration * 60000,
    ).toISOString();
    return {
      patch: {
        ...base,
        scheduledStartAt: toLocalInputValue(block.start_time),
        scheduledEndAt: toLocalInputValue(end),
        durationMinutes: String(block.duration),
        dueAt: '',
      },
      note: null,
    };
  }
  if (block.start_time) {
    return { patch: { ...base, dueAt: toLocalInputValue(block.start_time) }, note: null };
  }
  if (block.deadline_fixed) {
    return { patch: { ...base, dueAt: `${block.deadline_fixed}T00:00` }, note: null };
  }
  if (block.duration) {
    return { patch: { ...base, durationMinutes: String(block.duration) }, note: null };
  }
  if (block.scheduling_window_start || block.scheduling_window_end) {
    return {
      patch: base,
      note: `Window: ${block.scheduling_window_start ? toLocalInputValue(block.scheduling_window_start).slice(0, 10) : 'flexible'} — pick a specific time below.`,
    };
  }
  return {
    patch: base,
    note: location ? null : "Didn't find a date or duration in that — try the chips below.",
  };
}

export function useTaskWhenParser() {
  const client = useApiClient();
  return useMutation({
    mutationFn: async (transcript: string) => {
      const response = await client.api.tasks.parse.$post({
        json: {
          transcript,
          referenceDate: new Date().toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      });
      if (!response.ok) throw new Error("Couldn't parse that.");
      return response.json();
    },
  });
}
