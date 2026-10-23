// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { makeTaskListItem } from '../../fixtures';

interface PressableProps {
  children: React.ReactNode;
  onPress?: () => void;
  testID?: string;
}

vi.mock('react-native', () => ({
  Pressable: ({ children, onPress, testID }: PressableProps) => (
    <button data-testid={testID} onClick={onPress}>
      {children}
    </button>
  ),
  Text: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('~/components/theme', async () => (await import('../../mocks/theme')).themeModuleMock);
vi.mock('~/components/ui', () => ({
  BottomSheet: ({ children, visible }: { children: React.ReactNode; visible: boolean }) =>
    visible ? <div>{children}</div> : null,
}));
vi.mock('~/components/ui/icon', () => ({ default: () => null }));
vi.mock('@expo/ui/community/datetime-picker', () => ({
  default: ({
    minimumDate,
    testID,
    value,
  }: {
    minimumDate: Date;
    testID?: string;
    value: Date;
  }) => (
    <div
      data-minimum-date={minimumDate.toISOString()}
      data-testid={testID}
      data-value={value.toISOString()}
    />
  ),
}));

const { MoveSheet } = await import('~/components/tasks/MoveSheet');

describe('MoveSheet', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('refreshes the date when opening the picker after midnight', () => {
    vi.useFakeTimers({ now: new Date('2026-10-23T23:59:00.000Z') });
    render(<MoveSheet task={makeTaskListItem('task')} onClose={vi.fn()} onMove={vi.fn()} />);

    vi.setSystemTime(new Date('2026-10-24T00:01:00.000Z'));
    fireEvent.click(screen.getByTestId('move-pick'));

    const picker = screen.getByTestId('move-date-picker');
    expect(picker.getAttribute('data-value')).toBe('2026-10-24T00:01:00.000Z');
    expect(picker.getAttribute('data-minimum-date')).toBe('2026-10-24T00:01:00.000Z');
  });
});
