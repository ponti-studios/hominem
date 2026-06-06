import * as ProgressPrimitive from '@radix-ui/react-progress';
import * as React from 'react';

import { cn } from '../lib/utils';

function Progress({
  className,
  value,
  indicatorClassName,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & {
  indicatorClassName?: string;
}) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn('bg-primary/20 relative h-2 w-full overflow-hidden rounded-full', className)}
      value={value}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn('bg-primary h-full w-full flex-1 transition-all', indicatorClassName)}
        style={{ transform: `translateX(-${100 - (value ?? 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}

interface PercentageProgressBarProps {
  label: string;
  percentage: number;
  color?: string;
  className?: string;
}

function PercentageProgressBar({
  label,
  percentage,
  color = 'bg-primary',
  className,
}: PercentageProgressBarProps) {
  const clampedPercentage = Math.max(0, Math.min(100, percentage));

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">{clampedPercentage.toFixed(0)}%</span>
      </div>
      <Progress value={clampedPercentage} indicatorClassName={color} />
    </div>
  );
}

interface VolumeProgressBarProps {
  label: string;
  count: number;
  maxCount: number;
  color?: string;
  className?: string;
}

function VolumeProgressBar({
  label,
  count,
  maxCount,
  color = 'bg-primary',
  className,
}: VolumeProgressBarProps) {
  const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">{count}</span>
      </div>
      <Progress value={percentage} indicatorClassName={color} />
    </div>
  );
}

export { PercentageProgressBar, Progress, VolumeProgressBar };
export type { PercentageProgressBarProps, VolumeProgressBarProps };
