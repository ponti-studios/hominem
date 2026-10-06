// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const create = vi.fn();
vi.mock('~/services/tasks/use-task-create', () => ({ useTaskCreate: () => ({ mutate: create }) }));
vi.mock('react-native', () => ({
  View: ({ children, testID }: { children: React.ReactNode; testID?: string }) => (
    <div data-testid={testID}>{children}</div>
  ),
}));
vi.mock('~/components/theme', async () => ({
  ...(await import('../../mocks/theme')).themeModuleMock,
  fontFamilies: { sans: 'sans' },
  withAlpha: (color: string) => color,
}));
vi.mock('~/components/ui', () => ({
  TextField: ({
    onChangeText,
    onSubmitEditing,
    testID,
    value,
  }: {
    onChangeText: (value: string) => void;
    onSubmitEditing: () => void;
    testID: string;
    value: string;
  }) => (
    <input
      data-testid={testID}
      onChange={(event) => onChangeText(event.target.value)}
      onKeyDown={(event) => event.key === 'Enter' && onSubmitEditing()}
      value={value}
    />
  ),
}));
vi.mock('~/components/composer/ComposerSendButton', () => ({
  ComposerSendButton: ({
    disabled,
    onPress,
    testID,
  }: {
    disabled: boolean;
    onPress: () => void;
    testID: string;
  }) => <button data-testid={testID} disabled={disabled} onClick={onPress} />,
}));

const { TaskComposer } = await import('~/components/tasks/TaskComposer');

describe('TaskComposer', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('creates an undated task and clears the field', () => {
    render(<TaskComposer />);
    fireEvent.change(screen.getByTestId('task-composer-input'), {
      target: { value: '  Call mum ' },
    });
    fireEvent.click(screen.getByTestId('task-composer-submit'));
    expect(create).toHaveBeenCalledWith({ title: 'Call mum' });
    expect(screen.getByTestId<HTMLInputElement>('task-composer-input').value).toBe('');
  });

  it('does nothing for an empty title', () => {
    render(<TaskComposer />);
    expect(screen.getByTestId<HTMLButtonElement>('task-composer-submit').disabled).toBe(true);
    fireEvent.keyDown(screen.getByTestId('task-composer-input'), { key: 'Enter' });
    expect(create).not.toHaveBeenCalled();
  });
});
