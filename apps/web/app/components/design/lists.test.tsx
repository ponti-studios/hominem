import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { List } from './lists';

describe('List', () => {
  it('composes search, items, and pagination in one list container', () => {
    const onPageChange = vi.fn();

    render(
      <List>
        <List.Search>
          <input aria-label="Search transactions" />
        </List.Search>
        <List.Items ariaLabel="Transactions">
          <li>Parking Garage</li>
        </List.Items>
        <List.Pagination
          currentPage={0}
          totalPages={3}
          onPageChange={onPageChange}
          summary="12 transactions"
        />
      </List>,
    );

    expect(screen.getByRole('list', { name: 'Transactions' })).toBeDefined();
    expect(screen.getByText('12 transactions')).toBeDefined();
    expect(screen.getByText('Page 1 of 3')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));

    expect(onPageChange).toHaveBeenCalledWith(1);
  });
});
