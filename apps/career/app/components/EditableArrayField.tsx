import { CheckIcon, PencilIcon, PlusIcon, TrashIcon, XIcon } from 'lucide-react'
import { memo, useState } from 'react'
import { Button } from '~/components/ui/button'
import { normalizeString } from '~/lib/utils'

interface EditableArrayFieldProps {
  label: string
  value: string[]
  field: string
  placeholder?: string
  className?: string
  onSave?: (field: string, value: string[]) => void
}

interface ArrayItemProps {
  value: string
  index: number
  placeholder?: string
  onUpdate: (index: number, value: string) => void
  onRemove: (index: number) => void
  onKeyDown: (e: React.KeyboardEvent, index: number) => void
}

const ArrayItem = memo(function ArrayItem({
  value,
  index,
  placeholder,
  onUpdate,
  onRemove,
  onKeyDown,
}: ArrayItemProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    onUpdate(index, newValue)
  }

  return (
    <div className="flex items-center gap-2" data-testid={`array-item-${normalizeString(value)}`}>
      <input
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={(e) => onKeyDown(e, index)}
        className="flex-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
        placeholder={placeholder}
        data-testid={`array-input-${normalizeString(value)}`}
      />
      <Button
        type="button"
        onClick={() => onRemove(index)}
        variant="ghost"
        size="sm"
        className="p-2 text-red-600 hover:bg-red-50"
        data-testid={`remove-item-${normalizeString(value)}`}
        aria-label={`Remove item ${value}`}
      >
        <TrashIcon className="w-4 h-4" />
      </Button>
    </div>
  )
})

export function EditableArrayField({
  label,
  value,
  field,
  placeholder,
  className = '',
  onSave,
}: EditableArrayFieldProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValues, setEditValues] = useState(value)

  // Reset edit values when entering edit mode
  const handleEdit = () => {
    setEditValues(value)
    setIsEditing(true)
  }

  const handleSave = () => {
    const filteredValues = editValues.map((v) => v.trim()).filter((v) => v !== '')

    if (onSave) {
      onSave(field, filteredValues)
    } else {
      const form = document.createElement('form')
      form.method = 'POST'
      form.style.display = 'none'

      const fieldInput = document.createElement('input')
      fieldInput.name = 'field'
      fieldInput.value = field

      const valueInput = document.createElement('input')
      valueInput.name = 'value'
      valueInput.value = JSON.stringify(filteredValues)

      form.appendChild(fieldInput)
      form.appendChild(valueInput)
      document.body.appendChild(form)

      try {
        form.submit()
      } catch (error) {
        console.error('Form submission attempted:', { field, value: filteredValues })
        console.error(error)
      }

      document.body.removeChild(form)
    }

    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditValues(value)
    setIsEditing(false)
  }

  const addItem = () => {
    setEditValues((prev) => [...prev, ''])
  }

  const removeItem = (index: number) => {
    setEditValues((prev) => prev.filter((_, i) => i !== index))
  }

  const updateItem = (index: number, newValue: string) => {
    setEditValues((prev) => {
      const updated = [...prev]
      updated[index] = newValue
      return updated
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (index === editValues.length - 1 && editValues[index].trim() !== '') {
        addItem()
      }
    }
  }

  if (isEditing) {
    return (
      <div className={className} data-testid={`editable-array-field-${field}`}>
        <div className="block text-sm font-medium text-slate-700 mb-2">{label}</div>
        <div className="space-y-2">
          {editValues.map((item, index) => (
            <ArrayItem
              key={`edit-${field}-${normalizeString(item)}`}
              value={item}
              index={index}
              placeholder={placeholder}
              onUpdate={updateItem}
              onRemove={removeItem}
              onKeyDown={handleKeyDown}
            />
          ))}
          <Button
            type="button"
            onClick={addItem}
            variant="ghost"
            size="sm"
            className="text-blue-600 hover:bg-blue-50"
            data-testid="add-item-button"
          >
            <PlusIcon className="w-4 h-4 mr-1" />
            Add {label.slice(0, -1)}
          </Button>
          <div className="flex items-center gap-2 pt-2">
            <Button
              type="button"
              onClick={handleSave}
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
              data-testid="save-button"
            >
              <CheckIcon className="w-4 h-4 mr-1" />
              Save
            </Button>
            <Button
              type="button"
              onClick={handleCancel}
              variant="ghost"
              size="sm"
              className="text-slate-600 hover:bg-slate-100"
              data-testid="cancel-button"
            >
              <XIcon className="w-4 h-4 mr-1" />
              Cancel
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={className} data-testid={`editable-array-field-${field}`}>
      <div className="block text-sm font-medium text-slate-700 mb-2">{label}</div>
      <div className="group">
        <div className="space-y-2" data-testid="array-items-display">
          {value.length > 0 ? (
            value.map((item) => (
              <div
                key={`display-${field}-${normalizeString(item)}`}
                className="text-slate-900 bg-slate-50 rounded px-3 py-2"
                data-testid={`display-item-${normalizeString(item)}`}
              >
                {item}
              </div>
            ))
          ) : (
            <div className="text-slate-400 italic" data-testid="empty-state">
              No {label.toLowerCase()} added yet
            </div>
          )}
        </div>
        <div className="flex justify-between items-center mt-2">
          <span className="text-sm text-slate-500" data-testid="item-count">
            {value.length} item{value.length !== 1 ? 's' : ''}
          </span>
          <Button
            type="button"
            onClick={handleEdit}
            variant="ghost"
            size="sm"
            className="p-1 text-slate-400 hover:text-slate-600 focus:text-slate-600"
            aria-label={`Edit ${label}`}
            data-testid="edit-button"
          >
            <PencilIcon className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
