import { cn } from '~/lib/utils'

interface ProgressBarProps {
  label: string
  value: string | number
  percentage: number
  color?: string
  backgroundColor?: string
  size?: 'sm' | 'md' | 'lg'
  valueColor?: string
  className?: string
}

export function ProgressBar({
  label,
  value,
  percentage,
  color = 'bg-blue-500',
  backgroundColor = 'bg-gray-100',
  size = 'md',
  valueColor,
  className,
}: ProgressBarProps) {
  const sizeClasses = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3',
  }

  const barHeight = sizeClasses[size]

  // Auto-determine value color based on the bar color if not provided
  const defaultValueColor = color.includes('blue')
    ? 'text-blue-600'
    : color.includes('green')
      ? 'text-green-600'
      : color.includes('yellow')
        ? 'text-yellow-600'
        : color.includes('red')
          ? 'text-red-600'
          : color.includes('gray')
            ? 'text-gray-600'
            : 'text-gray-600'

  const finalValueColor = valueColor || defaultValueColor

  return (
    <div className={cn('space-y-1', className)}>
      {/* Label and Value */}
      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-600">{label}</span>
        <span className={cn('text-sm font-medium', finalValueColor)}>{value}</span>
      </div>

      {/* Progress Bar */}
      <div className={cn('rounded-full', backgroundColor, barHeight)}>
        <div
          className={cn('rounded-full transition-all duration-300', color, barHeight)}
          style={{ width: `${Math.min(Math.max(percentage, 0), 100)}%` }}
        />
      </div>
    </div>
  )
}

// Convenience component for common progress bar with percentage
export function PercentageProgressBar({
  label,
  percentage,
  color = 'bg-blue-500',
  size = 'md',
  decimals = 1,
  className,
}: {
  label: string
  percentage: number
  color?: string
  size?: 'sm' | 'md' | 'lg'
  decimals?: number
  className?: string
}) {
  return (
    <ProgressBar
      label={label}
      value={`${percentage.toFixed(decimals)}%`}
      percentage={percentage}
      color={color}
      size={size}
      className={className}
    />
  )
}

// Convenience component for volume-based progress bars
export function VolumeProgressBar({
  label,
  count,
  maxCount,
  color = 'bg-gray-500',
  size = 'md',
  className,
}: {
  label: string
  count: number
  maxCount: number
  color?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0

  return (
    <ProgressBar
      label={label}
      value={count.toString()}
      percentage={percentage}
      color={color}
      size={size}
      className={className}
    />
  )
}
