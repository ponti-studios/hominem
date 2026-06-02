import { ChevronDown, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '~/components/ui/button'

interface QuickAction {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }> | (() => React.ReactElement)
  onClick: () => void
}

interface QuickActionsDropdownProps {
  actions: QuickAction[]
  className?: string
}

export function QuickActionsDropdown({ actions, className = '' }: QuickActionsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (!target.closest('.quick-actions-dropdown')) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleActionClick = (action: QuickAction) => {
    action.onClick()
    setIsOpen(false)
  }

  return (
    <div className={`relative quick-actions-dropdown ${className}`}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2"
      >
        <Plus className="h-4 w-4" />
        Quick Actions
        <ChevronDown className="h-4 w-4" />
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
          <div className="py-1">
            {actions.map((action) => {
              const Icon = action.icon
              return (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => handleActionClick(action)}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  {typeof Icon === 'function' && Icon.length === 0 ? (
                    <Icon />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                  {action.label}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
