import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '../lib/utils';

const badgeVariants = cva(
  'void-focus inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded border border-transparent px-1.5 py-px text-xs font-medium [&>svg]:size-3 [&>svg]:pointer-events-none aria-invalid:border-destructive aria-invalid:ring-destructive/20',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground [a&]:void-hover [a&]:[--void-hover-bg:color-mix(in_srgb,var(--color-primary)_90%,white_10%)] [a&]:[--void-hover-color:var(--color-primary-foreground)] [a&]:[--void-hover-border:transparent]',
        secondary:
          'bg-secondary text-secondary-foreground [a&]:void-hover [a&]:[--void-hover-bg:color-mix(in_srgb,var(--color-secondary)_80%,white_20%)] [a&]:[--void-hover-color:var(--color-secondary-foreground)] [a&]:[--void-hover-border:transparent]',
        destructive:
          'bg-destructive text-destructive-foreground [a&]:void-hover [a&]:[--void-hover-bg:color-mix(in_srgb,var(--color-destructive)_90%,white_10%)] [a&]:[--void-hover-color:var(--color-destructive-foreground)] [a&]:[--void-hover-border:transparent] [--void-focus-shadow:0_0_0_3px_color-mix(in_srgb,var(--color-destructive)_20%,transparent)]',
        outline:
          'border-border text-foreground [a&]:void-hover [a&]:[--void-hover-bg:var(--color-accent)] [a&]:[--void-hover-color:var(--color-accent-foreground)] [a&]:[--void-hover-border:var(--color-accent)]',
        ghost:
          '[a&]:void-hover [a&]:[--void-hover-bg:var(--color-accent)] [a&]:[--void-hover-color:var(--color-accent-foreground)] [a&]:[--void-hover-border:transparent]',
        link: 'text-primary underline-offset-4 [a&]:void-hover [a&]:hover:underline [a&]:[--void-hover-bg:transparent] [a&]:[--void-hover-color:var(--color-secondary-foreground)] [a&]:[--void-hover-border:transparent]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

function Badge({
  className,
  variant = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'span';

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
