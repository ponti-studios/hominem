// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  Pressable: ({
    accessibilityLabel,
    children,
    onPress,
    testID,
  }: {
    accessibilityLabel?: string;
    children: React.ReactNode;
    onPress?: () => void;
    testID?: string;
  }) => (
    <button aria-label={accessibilityLabel} data-testid={testID} onClick={onPress}>
      {children}
    </button>
  ),
  Text: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('~/components/theme', async () => (await import('../../mocks/theme')).themeModuleMock);
vi.mock('~/components/ui/icon', () => ({ default: () => null }));

const { InboxRow } = await import('~/components/tasks/InboxRow');

describe('InboxRow', () => {
  afterEach(cleanup);

  it('shows how many tasks are waiting and opens triage when pressed', () => {
    const onPress = vi.fn();
    render(<InboxRow count={3} onPress={onPress} />);

    expect(screen.getByText('3 to place')).toBeTruthy();
    fireEvent.click(screen.getByTestId('tasks-inbox-row'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
