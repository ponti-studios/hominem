import { clsx } from 'clsx'
import { forwardRef } from 'react'

interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  size?: 'sm' | 'default' | 'lg'
}

const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  (
    { className, checked, onCheckedChange, onChange, size = 'default', disabled, ...props },
    ref
  ) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onCheckedChange?.(e.target.checked)
      onChange?.(e)
    }

    const sizeClasses = {
      sm: {
        track: 'h-5 w-9',
        thumb: 'h-4 w-4',
        translate: 'translate-x-4',
      },
      default: {
        track: 'h-6 w-11',
        thumb: 'h-5 w-5',
        translate: 'translate-x-5',
      },
      lg: {
        track: 'h-7 w-14',
        thumb: 'h-6 w-6',
        translate: 'translate-x-7',
      },
    }

    const { track, thumb, translate } = sizeClasses[size]

    return (
      <label
        className={clsx(
          'relative inline-flex cursor-pointer',
          disabled && 'cursor-not-allowed opacity-50'
        )}
      >
        <input
          type="checkbox"
          ref={ref}
          className="sr-only"
          checked={checked}
          onChange={handleChange}
          disabled={disabled}
          {...props}
        />
        <div
          className={clsx(
            'relative inline-flex items-center rounded-full transition-colors duration-200 ease-in-out focus-within:outline-none focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2',
            track,
            checked ? 'bg-blue-600' : 'bg-gray-200',
            className
          )}
        >
          <span
            className={clsx(
              'inline-block transform rounded-full bg-white shadow-lg transition-transform duration-200 ease-in-out',
              thumb,
              checked ? translate : 'translate-x-0.5'
            )}
          />
        </div>
      </label>
    )
  }
)
Switch.displayName = 'Switch'

export { Switch }
