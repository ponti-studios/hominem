// @vitest-environment jsdom
import { fireEvent, render } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  View: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('~/components/theme', () => ({
  useAppTheme: () => ({ colors: { primaryForeground: '' } }),
  useStyles: (factory: (theme: object) => unknown) => factory({}),
}));
vi.mock('~/components/ui/button', () => ({
  Button: ({
    label,
    onPress,
    testID,
  }: {
    label: string;
    onPress?: () => void;
    testID?: string;
  }) => (
    <button data-testid={testID} onClick={onPress}>
      {label}
    </button>
  ),
}));

const { CancelRow } = await import('~/components/time/TimeResultActions');

describe('CancelRow', () => {
  it('invokes its cancel callback', () => {
    const onCancel = vi.fn();
    const { getByTestId } = render(<CancelRow testID="cancel" onCancel={onCancel} />);

    fireEvent.click(getByTestId('cancel'));

    expect(onCancel).toHaveBeenCalledOnce();
  });
});
