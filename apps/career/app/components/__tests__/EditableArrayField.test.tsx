import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { normalizeString } from '~/lib/utils'
import { EditableArrayField } from '../EditableArrayField'

interface EditableArrayFieldProps {
  label: string
  value: string[]
  field: string
  workExperienceId: string
  placeholder?: string
  className?: string
  onSave?: (field: string, value: string[]) => void
}

describe.skip('EditableArrayField', () => {
  const defaultProps: EditableArrayFieldProps = {
    label: 'Test Items',
    value: ['Item 1', 'Item 2'],
    field: 'test-field',
    workExperienceId: 'work-exp-1',
    placeholder: 'Enter test item',
  }

  beforeEach(() => {
    // Clear any existing forms from previous tests
    document.body.innerHTML = ''
    // Clear console.log spy
    vi.clearAllMocks()
  })

  describe('Display Mode', () => {
    it('renders the label correctly', () => {
      render(<EditableArrayField {...defaultProps} />)
      expect(screen.getByText('Test Items')).toBeInTheDocument()
    })

    it('displays all items when value has items', () => {
      render(<EditableArrayField {...defaultProps} />)

      expect(screen.getByTestId(`display-item-${normalizeString('Item 1')}`)).toHaveTextContent(
        'Item 1'
      )
      expect(screen.getByTestId(`display-item-${normalizeString('Item 2')}`)).toHaveTextContent(
        'Item 2'
      )
    })

    it('shows correct item count', () => {
      render(<EditableArrayField {...defaultProps} />)
      expect(screen.getByTestId('item-count')).toHaveTextContent('2 items')
    })

    it('shows singular "item" for count of 1', () => {
      render(<EditableArrayField {...defaultProps} value={['Single Item']} />)
      expect(screen.getByTestId('item-count')).toHaveTextContent('1 item')
    })

    it('shows empty state when no items', () => {
      render(<EditableArrayField {...defaultProps} value={[]} />)

      expect(screen.getByTestId('empty-state')).toHaveTextContent('No test items added yet')
      expect(screen.getByTestId('item-count')).toHaveTextContent('0 items')
    })

    it('has edit button with proper aria-label', () => {
      render(<EditableArrayField {...defaultProps} />)

      const editButton = screen.getByTestId('edit-button')
      expect(editButton).toHaveAttribute('aria-label', 'Edit Test Items')
    })

    it('applies custom className', () => {
      render(<EditableArrayField {...defaultProps} className="custom-class" />)

      const container = screen.getByTestId('editable-array-field-test-field')
      expect(container).toHaveClass('custom-class')
    })
  })

  describe('Edit Mode', () => {
    it('switches to edit mode when edit button is clicked', async () => {
      const user = userEvent.setup()
      render(<EditableArrayField {...defaultProps} />)

      await user.click(screen.getByTestId('edit-button'))

      expect(screen.getByTestId(`array-input-${normalizeString('Item 1')}`)).toBeInTheDocument()
      expect(screen.getByTestId(`array-input-${normalizeString('Item 2')}`)).toBeInTheDocument()
      expect(screen.getByTestId('save-button')).toBeInTheDocument()
      expect(screen.getByTestId('cancel-button')).toBeInTheDocument()
    })

    it('shows input fields with correct values', async () => {
      const user = userEvent.setup()
      render(<EditableArrayField {...defaultProps} />)

      await user.click(screen.getByTestId('edit-button'))

      expect(screen.getByTestId(`array-input-${normalizeString('Item 1')}`)).toHaveValue('Item 1')
      expect(screen.getByTestId(`array-input-${normalizeString('Item 2')}`)).toHaveValue('Item 2')
    })

    it('shows placeholder text in input fields', async () => {
      const user = userEvent.setup()
      render(<EditableArrayField {...defaultProps} />)

      await user.click(screen.getByTestId('edit-button'))

      expect(screen.getByTestId(`array-input-${normalizeString('Item 1')}`)).toHaveAttribute(
        'placeholder',
        'Enter test item'
      )
    })

    it('shows add button with correct text', async () => {
      const user = userEvent.setup()
      render(<EditableArrayField {...defaultProps} />)

      await user.click(screen.getByTestId('edit-button'))

      expect(screen.getByTestId('add-item-button')).toHaveTextContent('Add Test Item')
    })

    it('shows remove buttons for each item', async () => {
      const user = userEvent.setup()
      render(<EditableArrayField {...defaultProps} />)

      await user.click(screen.getByTestId('edit-button'))

      expect(screen.getByTestId(`remove-item-${normalizeString('Item 1')}`)).toBeInTheDocument()
      expect(screen.getByTestId(`remove-item-${normalizeString('Item 2')}`)).toBeInTheDocument()
    })
  })

  describe('Editing Functionality', () => {
    it('updates input value when typed', async () => {
      const user = userEvent.setup()
      render(<EditableArrayField {...defaultProps} />)

      await user.click(screen.getByTestId('edit-button'))
      const input = screen.getByTestId(`array-input-${normalizeString('Item 1')}`)

      await user.clear(input)
      await user.type(input, 'Updated Item')

      expect(input).toHaveValue('Updated Item')
    })

    it('adds new item when add button is clicked', async () => {
      const user = userEvent.setup()
      render(<EditableArrayField {...defaultProps} />)

      await user.click(screen.getByTestId('edit-button'))
      await user.click(screen.getByTestId('add-item-button'))

      // New empty item should have an empty string as its test ID
      expect(screen.getByTestId('array-input-')).toBeInTheDocument()
      expect(screen.getByTestId('array-input-')).toHaveValue('')
    })

    it('removes item when remove button is clicked', async () => {
      const user = userEvent.setup()
      render(<EditableArrayField {...defaultProps} />)

      await user.click(screen.getByTestId('edit-button'))
      await user.click(screen.getByTestId(`remove-item-${normalizeString('Item 1')}`))

      // After removing first item, second item becomes the first
      expect(screen.getByTestId(`array-input-${normalizeString('Item 2')}`)).toHaveValue('Item 2')
      // Should only have one input field now
      expect(
        screen.queryByTestId(`array-input-${normalizeString('Item 1')}`)
      ).not.toBeInTheDocument()
    })

    it('adds new item when Enter is pressed on last input with content', async () => {
      const user = userEvent.setup()
      render(<EditableArrayField {...defaultProps} />)

      await user.click(screen.getByTestId('edit-button'))
      const lastInput = screen.getByTestId(`array-input-${normalizeString('Item 2')}`)

      await user.type(lastInput, 'Some content')
      await user.keyboard('{Enter}')

      // New item should have the content as its test ID
      expect(screen.getByTestId('array-input-Some content')).toBeInTheDocument()
    })

    it('does not add new item when Enter is pressed on empty last input', async () => {
      const user = userEvent.setup()
      render(<EditableArrayField {...defaultProps} />)

      await user.click(screen.getByTestId('edit-button'))
      const lastInput = screen.getByTestId(`array-input-${normalizeString('Item 2')}`)

      await user.clear(lastInput)
      await user.keyboard('{Enter}')

      expect(screen.queryByTestId('array-input-')).not.toBeInTheDocument()
    })

    it('does not add new item when Shift+Enter is pressed', async () => {
      const user = userEvent.setup()
      render(<EditableArrayField {...defaultProps} />)

      await user.click(screen.getByTestId('edit-button'))
      const lastInput = screen.getByTestId(`array-input-${normalizeString('Item 2')}`)

      await user.keyboard('{Shift>}{Enter}{/Shift}')

      expect(screen.queryByTestId('array-input-')).not.toBeInTheDocument()
    })
  })

  describe('Save Functionality', () => {
    it('calls onSave callback when provided', async () => {
      const mockOnSave = vi.fn()
      const user = userEvent.setup()

      render(<EditableArrayField {...defaultProps} onSave={mockOnSave} />)

      await user.click(screen.getByTestId('edit-button'))
      const input = screen.getByTestId(`array-input-${normalizeString('Item 1')}`)
      await user.clear(input)
      await user.type(input, 'Updated Item')
      await user.click(screen.getByTestId('save-button'))

      expect(mockOnSave).toHaveBeenCalledWith('test-field', ['Updated Item', 'Item 2'])
    })

    it('filters out empty items when saving', async () => {
      const mockOnSave = vi.fn()
      const user = userEvent.setup()

      render(<EditableArrayField {...defaultProps} onSave={mockOnSave} />)

      await user.click(screen.getByTestId('edit-button'))
      await user.click(screen.getByTestId('add-item-button'))
      // Leave the new item empty
      await user.click(screen.getByTestId('save-button'))

      expect(mockOnSave).toHaveBeenCalledWith('test-field', ['Item 1', 'Item 2'])
    })

    it('trims whitespace from items when saving', async () => {
      const mockOnSave = vi.fn()
      const user = userEvent.setup()

      render(<EditableArrayField {...defaultProps} onSave={mockOnSave} />)

      await user.click(screen.getByTestId('edit-button'))
      const input = screen.getByTestId(`array-input-${normalizeString('Item 1')}`)

      // Clear the input first
      await user.clear(input)

      // Type the new value with spaces
      await user.type(input, '  Spaced Item  ')

      // Verify the input has the correct value before saving
      expect(input).toHaveValue('  Spaced Item  ')

      await user.click(screen.getByTestId('save-button'))

      expect(mockOnSave).toHaveBeenCalledWith('test-field', ['Spaced Item', 'Item 2'])
    })

    it('creates and submits form when no onSave callback provided', async () => {
      const user = userEvent.setup()

      render(<EditableArrayField {...defaultProps} />)

      await user.click(screen.getByTestId('edit-button'))

      // Should not crash when saving without callback
      await expect(user.click(screen.getByTestId('save-button'))).resolves.not.toThrow()

      // Should exit edit mode
      expect(
        screen.queryByTestId(`array-input-${normalizeString('Item 1')}`)
      ).not.toBeInTheDocument()
      expect(screen.getByTestId(`display-item-${normalizeString('Item 1')}`)).toBeInTheDocument()
    })

    it('exits edit mode after saving', async () => {
      const mockOnSave = vi.fn()
      const user = userEvent.setup()

      render(<EditableArrayField {...defaultProps} onSave={mockOnSave} />)

      await user.click(screen.getByTestId('edit-button'))
      await user.click(screen.getByTestId('save-button'))

      // Should be back in display mode
      expect(
        screen.queryByTestId(`array-input-${normalizeString('Item 1')}`)
      ).not.toBeInTheDocument()
      expect(screen.getByTestId(`display-item-${normalizeString('Item 1')}`)).toBeInTheDocument()
    })
  })

  describe('Cancel Functionality', () => {
    it('reverts changes when cancel is clicked', async () => {
      const user = userEvent.setup()
      render(<EditableArrayField {...defaultProps} />)

      await user.click(screen.getByTestId('edit-button'))
      const input = screen.getByTestId(`array-input-${normalizeString('Item 1')}`)
      await user.clear(input)
      await user.type(input, 'Changed Item')
      await user.click(screen.getByTestId('cancel-button'))

      // Should be back in display mode with original values
      expect(screen.getByTestId(`display-item-${normalizeString('Item 1')}`)).toHaveTextContent(
        'Item 1'
      )
    })

    it('exits edit mode when cancel is clicked', async () => {
      const user = userEvent.setup()
      render(<EditableArrayField {...defaultProps} />)

      await user.click(screen.getByTestId('edit-button'))
      await user.click(screen.getByTestId('cancel-button'))

      expect(
        screen.queryByTestId(`array-input-${normalizeString('Item 1')}`)
      ).not.toBeInTheDocument()
      expect(screen.getByTestId(`display-item-${normalizeString('Item 1')}`)).toBeInTheDocument()
    })

    it('removes added items when cancel is clicked', async () => {
      const user = userEvent.setup()
      render(<EditableArrayField {...defaultProps} />)

      await user.click(screen.getByTestId('edit-button'))
      await user.click(screen.getByTestId('add-item-button'))
      await user.click(screen.getByTestId('cancel-button'))

      // Should be back to original 2 items
      expect(screen.getByTestId('item-count')).toHaveTextContent('2 items')
    })
  })

  describe('Accessibility', () => {
    it('has proper aria-labels for remove buttons', async () => {
      const user = userEvent.setup()
      render(<EditableArrayField {...defaultProps} />)

      await user.click(screen.getByTestId('edit-button'))

      expect(screen.getByTestId(`remove-item-${normalizeString('Item 1')}`)).toHaveAttribute(
        'aria-label',
        'Remove item Item 1'
      )
      expect(screen.getByTestId(`remove-item-${normalizeString('Item 2')}`)).toHaveAttribute(
        'aria-label',
        'Remove item Item 2'
      )
    })

    it('has proper test ids for all interactive elements', () => {
      render(<EditableArrayField {...defaultProps} />)

      expect(screen.getByTestId('editable-array-field-test-field')).toBeInTheDocument()
      expect(screen.getByTestId('edit-button')).toBeInTheDocument()
      expect(screen.getByTestId('item-count')).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('handles empty initial value', () => {
      render(<EditableArrayField {...defaultProps} value={[]} />)

      expect(screen.getByTestId('empty-state')).toBeInTheDocument()
      expect(screen.getByTestId('item-count')).toHaveTextContent('0 items')
    })

    it('handles very long item text', () => {
      const longText =
        'This is a very long text that should still be handled properly by the component'
      render(<EditableArrayField {...defaultProps} value={[longText]} />)

      expect(screen.getByTestId(`display-item-${normalizeString(longText)}`)).toHaveTextContent(
        longText
      )
    })

    it('handles special characters in items', () => {
      const specialText = 'Item with "quotes" & <tags> and émojis 🎉'
      render(<EditableArrayField {...defaultProps} value={[specialText]} />)

      expect(screen.getByTestId(`display-item-${normalizeString(specialText)}`)).toHaveTextContent(
        specialText
      )
    })

    it('handles removing all items', async () => {
      const mockOnSave = vi.fn()
      const user = userEvent.setup()

      render(<EditableArrayField {...defaultProps} onSave={mockOnSave} />)

      await user.click(screen.getByTestId('edit-button'))
      await user.click(screen.getByTestId(`remove-item-${normalizeString('Item 1')}`))
      await user.click(screen.getByTestId(`remove-item-${normalizeString('Item 2')}`)) // Remove what was item 1
      await user.click(screen.getByTestId('save-button'))

      expect(mockOnSave).toHaveBeenCalledWith('test-field', [])
    })

    it('updates when value prop changes', async () => {
      const { rerender } = render(<EditableArrayField {...defaultProps} />)

      expect(screen.getByTestId(`display-item-${normalizeString('Item 1')}`)).toHaveTextContent(
        'Item 1'
      )

      // Change the value prop
      rerender(<EditableArrayField {...defaultProps} value={['New Item']} />)

      expect(screen.getByTestId(`display-item-${normalizeString('New Item')}`)).toHaveTextContent(
        'New Item'
      )
      expect(
        screen.queryByTestId(`display-item-${normalizeString('Item 1')}`)
      ).not.toBeInTheDocument()
      expect(screen.getByTestId('item-count')).toHaveTextContent('1 item')
    })
  })
})
