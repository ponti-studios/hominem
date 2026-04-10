import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ErrorState } from './error-state';

describe('ErrorState', () => {
  it('renders a consistent error panel', () => {
    const onAction = vi.fn();

    render(
      <ErrorState
        title="Something went wrong"
        message="The page could not be loaded."
        actionLabel="Reload"
        onAction={onAction}
      />,
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('The page could not be loaded.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
  });
});
