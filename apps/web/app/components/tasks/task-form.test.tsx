// @vitest-environment jsdom

import type { Task } from '@hominem/rpc/types';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { validateTaskDraft } from '~/hooks/use-task-form-draft';

import { TaskForm } from './task-form';

vi.mock('~/hooks/use-task-when-parser', () => ({
  useTaskWhenParser: () => ({ mutateAsync: vi.fn(), isPending: false }),
  mapParsedBlockToDraftPatch: (block: unknown) => ({ patch: {}, note: null, block }),
}));

afterEach(cleanup);

function MinimalTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Existing task',
    description: '',
    priority: 'medium',
    dueAt: null,
    scheduledStartAt: null,
    scheduledEndAt: null,
    durationMinutes: null,
    location: null,
    ...overrides,
  } as Task;
}

describe('TaskForm accordion', () => {
  it('toggles details open and closed through its own handler', () => {
    render(<TaskForm mode="create" onSubmit={() => {}} submitLabel="Create" />);
    const trigger = screen.getByRole('button', { name: /details/i });

    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Priority')).toBeTruthy();
    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('toggling details on an edit form does not dirty the draft', () => {
    render(
      <TaskForm
        hideSubmitUntilDirty
        initialTask={MinimalTask()}
        key="task-1"
        mode="edit"
        onSubmit={() => {}}
        submitLabel="Save changes"
        variant="spacious"
      />,
    );

    expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /details/i }));
    expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull();
  });
});

describe('TaskForm validation', () => {
  it('blocks a start time without an end time and keeps the draft', () => {
    const onSubmit = vi.fn();
    render(<TaskForm mode="create" onSubmit={onSubmit} submitLabel="Create" />);

    fireEvent.change(screen.getByPlaceholderText('Call the plumber'), {
      target: { value: 'Dentist' },
    });
    fireEvent.click(screen.getByRole('button', { name: /details/i }));
    fireEvent.change(screen.getByLabelText('Start', { selector: 'input' }), {
      target: { value: '2026-09-15T10:00' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(screen.getByText('Set both a start and an end time, or neither.')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits trimmed input once the draft is valid', () => {
    const onSubmit = vi.fn();
    render(<TaskForm mode="create" onSubmit={onSubmit} submitLabel="Create" />);

    fireEvent.change(screen.getByPlaceholderText('Call the plumber'), {
      target: { value: '  Dentist  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ title: 'Dentist' });
  });
});

describe('validateTaskDraft', () => {
  const base = {
    title: 'Task',
    description: '',
    priority: 'medium' as const,
    dueAt: '',
    scheduledStartAt: '',
    scheduledEndAt: '',
    durationMinutes: '',
    location: '',
  };

  it('requires a title', () => {
    expect(validateTaskDraft({ ...base, title: '   ' })).toBe('Title is required.');
  });

  it('rejects an end time at or before the start', () => {
    expect(
      validateTaskDraft({
        ...base,
        scheduledStartAt: '2026-09-15T10:00',
        scheduledEndAt: '2026-09-15T10:00',
      }),
    ).toBe('End time must be after the start time.');
  });

  it('rejects a non-integer duration', () => {
    expect(validateTaskDraft({ ...base, durationMinutes: '1.5' })).toBe(
      'Duration must be a whole number of minutes.',
    );
  });

  it('accepts a minimal valid draft', () => {
    expect(validateTaskDraft(base)).toBeNull();
  });
});
