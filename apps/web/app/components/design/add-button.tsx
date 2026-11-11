import { PlusIcon } from 'lucide-react';
import { forwardRef } from 'react';
import type { ComponentProps, ReactElement } from 'react';

import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';

type AddButtonProps = Omit<
  ComponentProps<typeof Button>,
  'aria-label' | 'children' | 'size' | 'variant'
> & {
  label: string;
  children?: ReactElement;
};

/** Icon-only add action for route headers and compact actions. */
export const AddButton = forwardRef<HTMLButtonElement, AddButtonProps>(function AddButton(
  { label, children, asChild, className, ...props },
  ref,
) {
  return (
    <Button
      {...props}
      ref={ref}
      asChild={asChild}
      variant="default"
      size="icon"
      aria-label={label}
      title={label}
      className={cn('rounded-sm', className)}
    >
      {asChild ? children : <PlusIcon aria-hidden />}
    </Button>
  );
});
