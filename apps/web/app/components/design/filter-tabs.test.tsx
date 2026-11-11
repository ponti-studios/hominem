import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FilterTabs } from './surfaces';

describe('FilterTabs', () => {
  it('exposes the selected filter and notifies when another filter is selected', () => {
    const onChange = vi.fn();
    render(
      <FilterTabs
        ariaLabel="Filter tasks by status"
        onChange={onChange}
        options={[
          { value: 'open', label: 'Open' },
          { value: 'completed', label: 'Completed' },
          { value: 'all', label: 'All' },
        ]}
        value="open"
      />,
    );

    expect(screen.getByRole('group', { name: 'Filter tasks by status' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Open' }).getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Completed' }));

    expect(onChange).toHaveBeenCalledWith('completed');
  });
});
