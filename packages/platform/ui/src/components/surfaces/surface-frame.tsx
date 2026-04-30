import type { ComponentPropsWithoutRef, ElementType } from 'react';

type SurfaceFrameProps<T extends ElementType = 'div'> = {
  as?: T;
  elevated?: boolean;
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'className'>;

export function SurfaceFrame<T extends ElementType = 'div'>({
  as,
  elevated = false,
  ...props
}: SurfaceFrameProps<T>) {
  const Comp = as ?? 'div';

  return (
    <Comp
      className={`rounded-3xl border-subtle bg-surface ${elevated ? 'shadow-sm' : ''}`}
      {...props}
    />
  );
}
