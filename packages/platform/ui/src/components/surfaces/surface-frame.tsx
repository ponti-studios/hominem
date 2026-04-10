import type { ComponentPropsWithoutRef, ElementType } from 'react';

import { cn } from '../../lib/utils';

type SurfaceFrameProps<T extends ElementType = 'div'> = {
  as?: T;
  elevated?: boolean;
  className?: string;
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'className'>;

export function SurfaceFrame<T extends ElementType = 'div'>({
  as,
  elevated = false,
  className,
  ...props
}: SurfaceFrameProps<T>) {
  const Comp = as ?? 'div';

  return (
    <Comp
      className={cn('rounded-3xl border-subtle bg-surface', elevated && 'shadow-sm', className)}
      {...props}
    />
  );
}
