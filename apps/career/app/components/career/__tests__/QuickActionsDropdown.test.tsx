import { fireEvent, render, screen } from '@testing-library/react'
import { Calendar, MessageSquare } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'
import { QuickActionsDropdown } from '../QuickActionsDropdown'

describe('QuickActionsDropdown', () => {
  const mockActions = [
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
  ]

  it('renders the dropdown button', () => {
    render(<QuickActionsDropdown actions={mockActions} />)
    expect(screen.getByText('Quick Actions')).toBeInTheDocument()
  })

  it('shows dropdown menu when clicked', () => {
    render(<QuickActionsDropdown actions={mockActions} />)

    const button = screen.getByText('Quick Actions')
    fireEvent.click(button)

    expect(screen.getByText('Test Action 1')).toBeInTheDocument()
    expect(screen.getByText('Test Action 2')).toBeInTheDocument()
    expect(screen.getByText('Test Action 3')).toBeInTheDocument()
  })

  it('calls onClick when action is clicked', () => {
    render(<QuickActionsDropdown actions={mockActions} />)

    const button = screen.getByText('Quick Actions')
    fireEvent.click(button)

    const actionButton = screen.getByText('Test Action 1')
    fireEvent.click(actionButton)

    expect(mockActions[0].onClick).toHaveBeenCalledTimes(1)
  })

  it('closes dropdown after action is clicked', () => {
    render(<QuickActionsDropdown actions={mockActions} />)

    const button = screen.getByText('Quick Actions')
    fireEvent.click(button)

    const actionButton = screen.getByText('Test Action 1')
    fireEvent.click(actionButton)

    expect(screen.queryByText('Test Action 1')).not.toBeInTheDocument()
  })

  it('renders custom icon components', () => {
    render(<QuickActionsDropdown actions={mockActions} />)

    const button = screen.getByText('Quick Actions')
    fireEvent.click(button)

    expect(screen.getByTestId('custom-icon')).toBeInTheDocument()
  })
})
