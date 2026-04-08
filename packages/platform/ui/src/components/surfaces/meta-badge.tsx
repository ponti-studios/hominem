import type { ReactNode } from 'react';

import { cn } from '../../lib/utils';

interface MetaBadgeProps {
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
  tone?: 'neutral' | 'subtle';
}

export function MetaBadge({ children, icon, className, tone = 'neutral' }: MetaBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs',
        tone === 'neutral'
          ? 'border border-subtle text-text-secondary'
          : 'bg-elevated text-text-tertiary',
        className,
      )}
    >
      {icon ? icon : null}
      {children}
    </span>
  );
}
