import type { ReactNode } from 'react';

import { cn } from '../lib/utils';
import { Badge } from './badge';

export type StatusTone = 'neutral' | 'info' | 'warning' | 'success' | 'danger';

const TONE_CLASS_NAMES: Record<StatusTone, string> = {
  neutral: 'border-border bg-muted text-muted-foreground',
  info: 'border-accent/30 bg-accent/10 text-accent',
  warning: 'border-warning/30 bg-warning/10 text-warning',
  success: 'border-success/30 bg-success/10 text-success',
  danger: 'border-destructive/30 bg-destructive/10 text-destructive',
};

export interface StatusBadgeProps {
  tone: StatusTone;
  label: ReactNode;
  className?: string;
}

export function StatusBadge({ tone, label, className }: StatusBadgeProps) {
  return (
    <Badge variant="outline" className={cn(TONE_CLASS_NAMES[tone], className)}>
      {label}
    </Badge>
  );
}
