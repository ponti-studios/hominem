import type { Task, TasksCreateInput, TasksUpdateInput } from '@hominem/rpc/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type Priority = 'low' | 'medium' | 'high';

/** Only submittable form data. UI state (accordion open, parse text) lives in components. */
export interface TaskFormDraft {
  title: string;
  description: string;
  priority: Priority;
  dueAt: string;
  scheduledStartAt: string;
  scheduledEndAt: string;
  durationMinutes: string;
  location: string;
}

export type TaskFormPatch = Partial<
  Pick<
    TaskFormDraft,
    'dueAt' | 'scheduledStartAt' | 'scheduledEndAt' | 'durationMinutes' | 'location'
  >
>;

export function toLocalInputValue(iso: string | null | undefined) {
  if (!iso) return '';
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromLocalInputValue(value: string) {
  return value ? new Date(value).toISOString() : null;
}

export function hasDetails(task: Task) {
  return (
    task.priority !== 'medium' ||
    Boolean(task.dueAt || task.scheduledStartAt || task.durationMinutes || task.location)
  );
}

function draftFromTask(task?: Task): TaskFormDraft {
  return {
    title: task?.title ?? '',
    description: task?.description ?? '',
    priority: task?.priority === 'low' || task?.priority === 'high' ? task.priority : 'medium',
    dueAt: toLocalInputValue(task?.dueAt),
    scheduledStartAt: toLocalInputValue(task?.scheduledStartAt),
    scheduledEndAt: toLocalInputValue(task?.scheduledEndAt),
    durationMinutes: task?.durationMinutes ? String(task.durationMinutes) : '',
    location: task?.location ?? '',
  };
}

/** Single shared validator so create + edit can't drift. Returns an error message or null. */
export function validateTaskDraft(draft: TaskFormDraft): string | null {
  if (!draft.title.trim()) return 'Title is required.';
  const nextStart = fromLocalInputValue(draft.scheduledStartAt);
  const nextEnd = fromLocalInputValue(draft.scheduledEndAt);
  if ((nextStart === null) !== (nextEnd === null)) {
    return 'Set both a start and an end time, or neither.';
  }
  if (nextStart && nextEnd && new Date(nextEnd) <= new Date(nextStart)) {
    return 'End time must be after the start time.';
  }
  if (draft.durationMinutes.trim()) {
    const duration = Number(draft.durationMinutes);
    if (!Number.isInteger(duration) || duration <= 0) {
      return 'Duration must be a whole number of minutes.';
    }
  }
  return null;
}

export function useTaskFormDraft(initialTask?: Task) {
  const [draft, setDraft] = useState(() => draftFromTask(initialTask));
  // Reset only when navigating to a different task — never on background
  // refetch identity changes, which would wipe unsaved edits mid-typing.
  const taskIdRef = useRef(initialTask?.id);
  useEffect(() => {
    if (initialTask?.id !== taskIdRef.current) {
      taskIdRef.current = initialTask?.id;
      setDraft(draftFromTask(initialTask));
    }
  }, [initialTask]);

  const reset = useCallback(() => setDraft(draftFromTask(initialTask)), [initialTask]);

  const setField = useCallback(
    <K extends keyof TaskFormDraft>(field: K, value: TaskFormDraft[K]) => {
      setDraft((current) => (current[field] === value ? current : { ...current, [field]: value }));
    },
    [],
  );

  const applyParsedWhen = useCallback((patch: TaskFormPatch) => {
    setDraft((current) => ({
      ...current,
      ...patch,
      ...(patch.dueAt !== undefined ||
      patch.scheduledStartAt !== undefined ||
      patch.scheduledEndAt !== undefined
        ? {
            dueAt: patch.dueAt ?? '',
            scheduledStartAt: patch.scheduledStartAt ?? '',
            scheduledEndAt: patch.scheduledEndAt ?? '',
          }
        : {}),
    }));
  }, []);

  const toCreateInput = useCallback(
    (): TasksCreateInput => ({
      title: draft.title.trim(),
      description: draft.description.trim() || undefined,
      artifactType: 'task',
      priority: draft.priority,
      dueAt: fromLocalInputValue(draft.dueAt),
      scheduledStartAt: fromLocalInputValue(draft.scheduledStartAt),
      scheduledEndAt: fromLocalInputValue(draft.scheduledEndAt),
      durationMinutes: draft.durationMinutes.trim() ? Number(draft.durationMinutes) : null,
      location: draft.location.trim() || null,
    }),
    [draft],
  );

  const toUpdateInput = useCallback(
    (): TasksUpdateInput => ({
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      priority: draft.priority,
      dueAt: fromLocalInputValue(draft.dueAt),
      scheduledStartAt: fromLocalInputValue(draft.scheduledStartAt),
      scheduledEndAt: fromLocalInputValue(draft.scheduledEndAt),
      durationMinutes: draft.durationMinutes.trim() ? Number(draft.durationMinutes) : null,
      location: draft.location.trim() || null,
    }),
    [draft],
  );

  const isDirty = useMemo(() => {
    if (!initialTask) return false;
    const initial = draftFromTask(initialTask);
    return (
      draft.title.trim() !== initial.title ||
      draft.description.trim() !== initial.description ||
      draft.priority !== initial.priority ||
      draft.dueAt !== initial.dueAt ||
      draft.scheduledStartAt !== initial.scheduledStartAt ||
      draft.scheduledEndAt !== initial.scheduledEndAt ||
      draft.durationMinutes !== initial.durationMinutes ||
      draft.location.trim() !== initial.location
    );
  }, [draft, initialTask]);

  return {
    draft,
    setDraft,
    reset,
    setField,
    applyParsedWhen,
    toCreateInput,
    toUpdateInput,
    isDirty,
  };
}
