import { PlusIcon } from 'lucide-react';
import type { ComponentProps, ReactElement } from 'react';

import { Button } from '~/components/ui/button';

type AddButtonProps = Omit<
  ComponentProps<typeof Button>,
  'aria-label' | 'children' | 'size' | 'variant'
> & {
  label: string;
  children?: ReactElement;
};

export function AddButton({
  label,
  children,
  asChild,
  className,
  ...props
}: AddButtonProps & { className?: string }) {
  return (
    <Button
      {...props}
      asChild={asChild}
      variant="outline"
      size="icon"
      aria-label={label}
      title={label}
      className={`rounded-full border-white/10 bg-white/[0.04] text-[#f2f4f8] transition-all hover:border-[#d7ff3e]/50 hover:text-[#d7ff3e] hover:shadow-[0_0_16px_-4px_rgb(215_255_62/0.5)] ${className ?? ''}`}
    >
      {asChild ? children : <PlusIcon aria-hidden />}
    </Button>
  );
}
