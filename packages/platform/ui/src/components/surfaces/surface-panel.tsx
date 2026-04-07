import type { ComponentPropsWithoutRef, ElementType } from 'react';

import { cn } from '../../lib/utils';

type SurfacePanelProps<T extends ElementType = 'div'> = {
  as?: T;
  className?: string;
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'className'>;

export function SurfacePanel<T extends ElementType = 'div'>({
  as,
  className,
  ...props
}: SurfacePanelProps<T>) {
  const Comp = as ?? 'div';

  return <Comp className={cn('rounded-3xl border-subtle bg-surface p-5', className)} {...props} />;
}
