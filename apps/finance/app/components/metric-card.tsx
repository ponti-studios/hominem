import { cn } from '@ponti-studios/ui/utilities';
import type { ComponentProps, ReactNode } from 'react';

interface MetricCardProps extends ComponentProps<'div'> {
  label: string;
  value: ReactNode;
  change?: ReactNode;
}

/** Finance analytics metric composition. */
export function MetricCard({ label, value, change, className, ...props }: MetricCardProps) {
  return (
    <div className={cn('ui-flat-card', className)} {...props}>
      <p className="ui-data-label mb-2">{label}</p>
      <p className="ui-data-value">{value ?? '—'}</p>
      {change != null ? <p className="text-muted-foreground mt-1.5 text-xs">{change}</p> : null}
    </div>
  );
}
