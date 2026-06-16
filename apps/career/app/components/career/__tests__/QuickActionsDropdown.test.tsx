import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Calendar, MessageSquare } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';

import { QuickActionsDropdown } from '../QuickActionsDropdown';

function createActions() {
  return [
    {
      id: 'test-action-1',
      label: 'Test Action 1',
      icon: MessageSquare,
      onClick: vi.fn(),
    },
    {
      id: 'test-action-2',
      label: 'Test Action 2',
      icon: Calendar,
      onClick: vi.fn(),
    },
    {
      id: 'test-action-3',
      label: 'Test Action 3',
      icon: () => <span data-testid="custom-icon">•</span>,
      onClick: vi.fn(),
    },
  ];
}

describe('QuickActionsDropdown', () => {
  function renderDropdown() {
    const actions = createActions();
    render(<QuickActionsDropdown actions={actions} />);
    return { actions };
  }

  it('renders the dropdown button', () => {
    renderDropdown();
    expect(screen.getByText('Quick Actions')).toBeInTheDocument();
  });

  const openMenu = () => {
    fireEvent.pointerDown(screen.getByRole('button', { name: /quick actions/i }));
  };

  it('shows dropdown menu when clicked', async () => {
    renderDropdown();

    openMenu();

    expect(await screen.findByText('Test Action 1')).toBeInTheDocument();
    expect(screen.getByText('Test Action 2')).toBeInTheDocument();
    expect(screen.getByText('Test Action 3')).toBeInTheDocument();
  });

  it('calls onClick when action is clicked', async () => {
    const { actions } = renderDropdown();

    openMenu();

    const actionButton = await screen.findByText('Test Action 1');
    fireEvent.click(actionButton);

    expect(actions[0].onClick).toHaveBeenCalledTimes(1);
  });

  it('closes dropdown after action is clicked', async () => {
    renderDropdown();

    openMenu();

    const actionButton = await screen.findByText('Test Action 1');
    fireEvent.click(actionButton);

    await waitFor(() => expect(screen.queryByText('Test Action 1')).not.toBeInTheDocument());
  });

  it('renders custom icon components', async () => {
    renderDropdown();

    openMenu();

    expect(await screen.findByTestId('custom-icon')).toBeInTheDocument();
  });
});
