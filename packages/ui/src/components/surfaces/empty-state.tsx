import type { ReactNode } from 'react';

import { cn } from '../../lib/utils';

interface EmptyStateProps {
  icon?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  layout?: 'centered' | 'inline';
  variant?: 'default' | 'dashed' | 'search' | 'quiet';
  size?: 'md' | 'lg';
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  children,
  layout = 'centered',
  variant = 'default',
  size = 'md',
  className,
}: EmptyStateProps) {
  const centered = layout === 'centered';
  const large = size === 'lg';

  return (
    <div
      className={cn(
        'rounded-3xl border bg-surface/95 shadow-xs',
        centered
          ? cn(
              'flex flex-col items-center justify-center text-center',
              large ? 'min-h-80 px-6 py-10' : 'min-h-64 px-5 py-8',
            )
          : cn('flex flex-col gap-3', large ? 'px-6 py-5' : 'px-5 py-4'),
        variant === 'default' && 'border-border-subtle',
        variant === 'dashed' && 'border-2 border-dashed border-border-subtle',
        variant === 'search' && 'border-dashed border-border-subtle bg-muted/30 shadow-none',
        variant === 'quiet' && 'border-transparent bg-muted/25 shadow-none',
        className,
      )}
    >
      {icon ? (
        <div
          className={cn(
            'flex items-center justify-center rounded-2xl border border-border-subtle bg-background text-text-tertiary',
            centered ? 'mb-4 size-12' : 'mb-1 size-10',
          )}
        >
          {icon}
        </div>
      ) : null}
      {title ? (
        <h2 className={cn('text-foreground', large ? 'heading-3' : 'heading-4')}>{title}</h2>
      ) : null}
      {description ? (
        <p
          className={cn(
            'body-3 text-text-secondary',
            centered && 'max-w-[34ch]',
            !centered && 'max-w-[52ch]',
          )}
        >
          {description}
        </p>
      ) : null}
      {children ? <div className={cn(centered ? 'mt-1' : '')}>{children}</div> : null}
      {action ? <div className={cn(centered ? 'mt-4' : 'mt-2')}>{action}</div> : null}
    </div>
  );
}

export type { EmptyStateProps };
