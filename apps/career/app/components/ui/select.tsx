import { cva, type VariantProps } from 'class-variance-authority'
import { clsx } from 'clsx'
import { ChevronDown } from 'lucide-react'
import { forwardRef } from 'react'

const selectVariants = cva(
  'flex w-full rounded-lg border border-gray-200 bg-white text-gray-900 shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-gray-50 appearance-none',
  {
    variants: {
      size: {
        sm: 'h-8 px-3 py-1 text-xs',
        default: 'h-10 px-3 py-2 text-sm',
        lg: 'h-12 px-4 py-3 text-base',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  }
)

interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'>,
    VariantProps<typeof selectVariants> {
  value?: string
  onValueChange?: (value: string) => void
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, size, value, onValueChange, onChange, children, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      onValueChange?.(e.target.value)
      onChange?.(e)
    }

    return (
      <div className="relative">
        <select
          ref={ref}
          className={clsx(selectVariants({ size }), 'pr-10', className)}
          value={value}
          onChange={handleChange}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" />
      </div>
    )
  }
)
Select.displayName = 'Select'

// For compatibility with the existing code structure
const SelectTrigger = ({
  children,
  className,
}: { children: React.ReactNode; className?: string }) => (
  <div className={clsx('relative', className)}>{children}</div>
)

const SelectValue = ({ placeholder }: { placeholder?: string }) => (
  <option value="" disabled>
    {placeholder}
  </option>
)

const SelectContent = ({ children }: { children: React.ReactNode }) => <>{children}</>

interface SelectItemProps {
  children: React.ReactNode
  value: string
}

const SelectItem = ({ children, value }: SelectItemProps) => (
  <option value={value}>{children}</option>
)

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue }
