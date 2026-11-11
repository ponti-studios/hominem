import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AddButton } from './add-button';

describe('AddButton', () => {
  it('shows the accessible label and forwards its click handler', () => {
    const onClick = vi.fn();
    render(<AddButton label="New collection" onClick={onClick} />);

    const button = screen.getByRole('button', { name: 'New collection' });
    expect(button.getAttribute('title')).toBe('New collection');

    fireEvent.click(button);

    expect(onClick).toHaveBeenCalledOnce();
  });
});
