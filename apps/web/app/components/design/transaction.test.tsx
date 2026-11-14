import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ProgressBar } from './progress-bar';
import { Transaction } from './transaction';

describe('shared finance components', () => {
  it('exposes progress values accessibly and clamps the visual value', () => {
    render(<ProgressBar value={12} max={10} label="Rulings completed" />);
    expect(
      screen.getByRole('progressbar', { name: 'Rulings completed' }).getAttribute('aria-valuenow'),
    ).toBe('10');
  });

  it('supports keyboard accessible transaction selection', () => {
    const onSelect = vi.fn();
    render(<Transaction description="Market" date="Nov 4" amount="−£12.00" onSelect={onSelect} />);
    const row = screen.getByRole('button', { name: /Market.*Nov 4.*−£12.00/ });
    expect(row.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(row);
    expect(onSelect).toHaveBeenCalledOnce();
  });
});
