import type { ComponentPropsWithoutRef, ElementType } from 'react';

type SurfacePanelProps<T extends ElementType = 'div'> = { as?: T } & Omit<
  ComponentPropsWithoutRef<T>,
  'as' | 'className'
>;

/** Finance analytics panel composition. */
export function SurfacePanel<T extends ElementType = 'div'>({
  as,
  ...props
}: SurfacePanelProps<T>) {
  const Component = as ?? 'div';
  return <Component className="border-border bg-surface rounded-3xl border p-5" {...props} />;
}
