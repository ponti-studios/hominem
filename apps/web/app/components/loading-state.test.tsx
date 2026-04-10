import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LoadingState } from '@hominem/ui';

describe('LoadingState', () => {
  it('renders the inline loading state', () => {
    render(<LoadingState variant="inline" message="Loading notes..." />);

    expect(screen.getByText('Loading notes...')).toBeInTheDocument();
  });
});
