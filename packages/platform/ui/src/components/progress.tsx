import * as ProgressPrimitive from '@radix-ui/react-progress';
import * as React from 'react';

import { cn } from '../lib/utils';

function clampPercentage(value: number) {
  return Math.min(Math.max(value, 0), 100);
}

function Progress({
  className,
  value,
  indicatorClassName,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & {
  indicatorClassName?: string;
}) {
  const clampedValue = clampPercentage(value ?? 0);

  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn('bg-primary/20 relative h-2 w-full overflow-hidden rounded-full', className)}
      value={clampedValue}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn('bg-primary h-full w-full flex-1 transition-all', indicatorClassName)}
        style={{ transform: `translateX(-${100 - clampedValue}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}

interface ProgressBarProps {
  label: string;
  value: string | number;
  percentage: number;
  color?: string;
  backgroundColor?: string;
  size?: 'sm' | 'md' | 'lg';
  valueColor?: string;
  className?: string;
}

const sizeClasses = {
  sm: 'h-1.5',
  md: 'h-2',
  lg: 'h-3',
} satisfies Record<NonNullable<ProgressBarProps['size']>, string>;

function ProgressBar({
  label,
  value,
  percentage,
  color = 'bg-primary',
  backgroundColor = 'bg-muted',
  size = 'md',
  valueColor,
  className,
}: ProgressBarProps) {
  const defaultValueColor = color.includes('green')
    ? 'text-green-600'
    : color.includes('yellow')
      ? 'text-yellow-600'
      : color.includes('red')
        ? 'text-red-600'
        : color.includes('gray')
          ? 'text-gray-600'
          : color.includes('blue')
            ? 'text-blue-600'
            : 'text-primary';

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className={cn('text-sm font-medium', valueColor ?? defaultValueColor)}>{value}</span>
      </div>
      <Progress
        value={percentage}
        className={cn(sizeClasses[size], backgroundColor)}
        indicatorClassName={color}
      />
    </div>
  );
}

function PercentageProgressBar({
  label,
  percentage,
  color = 'bg-primary',
  size = 'md',
  decimals = 1,
  className,
}: {
  label: string;
  percentage: number;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  decimals?: number;
  className?: string;
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
  );
}

function VolumeProgressBar({
  label,
  count,
  maxCount,
  color = 'bg-primary',
  size = 'md',
  className,
}: {
  label: string;
  count: number;
  maxCount: number;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;

  return (
    <ProgressBar
      label={label}
      value={count.toString()}
      percentage={percentage}
      color={color}
      size={size}
      className={className}
    />
  );
}

export { Progress, ProgressBar, PercentageProgressBar, VolumeProgressBar };
