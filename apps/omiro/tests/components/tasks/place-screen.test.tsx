// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { makeTaskListItem } from '../../fixtures';

interface PressableProps {
  children: React.ReactNode;
  onPress?: () => void;
  testID?: string;
}

vi.mock('react-native', () => ({
  Alert: { alert: vi.fn() },
  Pressable: ({ children, onPress, testID }: PressableProps) => (
    <button data-testid={testID} onClick={onPress}>
      {children}
    </button>
  ),
  ScrollView: ({ children, testID }: { children: React.ReactNode; testID?: string }) => (
    <div data-testid={testID}>{children}</div>
  ),
  Text: ({ children, testID }: { children: React.ReactNode; testID?: string }) => (
    <span data-testid={testID}>{children}</span>
  ),
  View: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('~/components/theme', async () => (await import('../../mocks/theme')).themeModuleMock);
vi.mock('~/components/ui/icon', () => ({ default: () => null }));
vi.mock('~/components/ui/button', () => ({
  Button: ({ label, onPress, testID }: { label: string; onPress: () => void; testID?: string }) => (
    <button data-testid={testID} onClick={onPress}>
      {label}
    </button>
  ),
}));
vi.mock('@expo/ui/community/datetime-picker', () => ({
  default: ({ testID }: { testID?: string }) => <div data-testid={testID} />,
}));

const back = vi.fn();
vi.mock('expo-router', () => ({ useRouter: () => ({ back }) }));

const mocks = vi.hoisted(() => ({
  tasks: new Array<unknown>(),
  update: vi.fn(),
  remove: vi.fn(),
  createNote: vi.fn(),
}));

vi.mock('~/services/tasks/use-tasks-query', () => ({
  useTasksQuery: () => ({ data: mocks.tasks }),
}));
vi.mock('~/services/tasks/use-task-update', () => ({
  useTaskUpdate: () => ({ mutate: mocks.update }),
}));
vi.mock('~/services/tasks/use-task-delete', () => ({
  useTaskDelete: () => ({ mutate: mocks.remove }),
}));
vi.mock('~/services/notes/use-create-note', () => ({
  useCreateNote: () => ({ mutateAsync: mocks.createNote }),
}));

const { PlaceScreen } = await import('~/components/tasks/PlaceScreen');
const { Alert } = await import('react-native');

function daysAgo(days: number) {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

describe('PlaceScreen', () => {
  beforeEach(() => {
    mocks.tasks = [
      makeTaskListItem('a', { title: 'Learn Spanish', createdAt: daysAgo(3) }),
      makeTaskListItem('b', { title: 'Fix the garage', createdAt: daysAgo(1) }),
      makeTaskListItem('dated', { title: 'Has a day', dueAt: '2026-10-08T10:00:00.000Z' }),
    ];
    mocks.createNote.mockResolvedValue({ id: 'note-1' });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows the first undated task and where it sits in the queue', () => {
    render(<PlaceScreen />);

    expect(screen.getByText('Learn Spanish')).toBeTruthy();
    expect(screen.getByText('1 of 2')).toBeTruthy();
    expect(screen.getByTestId('place-meta').textContent).toBe('Added 3 days ago');
    expect(screen.queryByText('Has a day')).toBeNull();
  });

  it('places the task on the chosen day, at local midnight', () => {
    render(<PlaceScreen />);

    fireEvent.click(screen.getByTestId('place-tomorrow'));

    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    expect(mocks.update).toHaveBeenCalledWith({
      taskId: 'a',
      patch: { dueAt: tomorrow.toISOString() },
    });
  });

  it('opens a date picker for Pick a date', () => {
    render(<PlaceScreen />);

    expect(screen.queryByTestId('place-date-picker')).toBeNull();
    fireEvent.click(screen.getByTestId('place-pick'));

    expect(screen.getByTestId('place-date-picker')).toBeTruthy();
  });

  it('drops a task', () => {
    render(<PlaceScreen />);

    fireEvent.click(screen.getByTestId('place-drop'));

    expect(mocks.remove).toHaveBeenCalledWith('a');
  });

  it('turns a task into a note, then removes the task', async () => {
    render(<PlaceScreen />);

    fireEvent.click(screen.getByTestId('place-note'));

    await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith('a'));
    expect(mocks.createNote).toHaveBeenCalledWith({
      text: 'Learn Spanish',
      title: 'Learn Spanish',
    });
  });

  it('keeps the task when the note could not be made', async () => {
    mocks.createNote.mockRejectedValue(new Error('offline'));
    render(<PlaceScreen />);

    fireEvent.click(screen.getByTestId('place-note'));

    await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it('moves to the next task on Decide later and finishes with a calm screen', () => {
    render(<PlaceScreen />);

    fireEvent.click(screen.getByTestId('place-later'));
    expect(screen.getByText('Fix the garage')).toBeTruthy();
    expect(screen.getByText('2 of 2')).toBeTruthy();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('place-later'));
    expect(screen.getByText('All placed')).toBeTruthy();

    fireEvent.click(screen.getByTestId('place-done'));
    expect(back).toHaveBeenCalled();
  });

  it('asks whether a task that waited 14 days is still wanted', () => {
    mocks.tasks = [makeTaskListItem('old', { title: 'Old wish', createdAt: daysAgo(20) })];
    render(<PlaceScreen />);

    expect(screen.getByTestId('place-meta').textContent).toBe('Still want this? Added 20 days ago');
  });

  it('shows the calm screen when nothing is undated', () => {
    mocks.tasks = [makeTaskListItem('dated', { dueAt: '2026-10-08T10:00:00.000Z' })];
    render(<PlaceScreen />);

    expect(screen.getByText('All placed')).toBeTruthy();
    expect(screen.getByText('Nothing is waiting for a day.')).toBeTruthy();
  });
});
