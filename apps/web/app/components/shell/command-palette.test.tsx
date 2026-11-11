import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { CommandPalette } from './command-palette';

describe('CommandPalette', () => {
  it('renders its dialog on an opaque theme surface', () => {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });

    render(
      <MemoryRouter>
        <CommandPalette open onClose={vi.fn()} />
      </MemoryRouter>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Jump anywhere' });
    expect(dialog.className).toContain('bg-background');
    expect(dialog.className).toContain('rounded-2xl');
    expect(dialog.className).toContain('shadow-2xl');
    expect(dialog.className).not.toMatch(/\bborder\b/);
    expect(dialog.parentElement?.querySelector('[aria-hidden]')?.className).toContain(
      'backdrop-blur-sm',
    );
    expect(dialog.parentElement?.querySelector('[aria-hidden]')?.className).toContain(
      'bg-black/55',
    );
    expect(screen.getByRole('option', { name: 'Tasks' }).textContent).toBe('Tasks');
    expect(screen.queryByText('Things to do, scheduled or not')).toBeNull();
  });
});
