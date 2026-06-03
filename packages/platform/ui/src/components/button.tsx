import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '../lib/utils';
import type { ButtonBaseProps } from './button.types';

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-secondary disabled:text-secondary-foreground disabled:opacity-60',
        primary:
          'bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-secondary disabled:text-secondary-foreground disabled:opacity-60',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive/20',
        icon: 'border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground',
        outline: 'border border-border bg-background text-foreground hover:bg-muted',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-muted',
        ghost: 'text-muted-foreground hover:bg-muted hover:text-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        xs: 'h-8 px-2 text-xs',
        sm: 'h-10 px-3',
        md: 'h-11 px-4',
        lg: 'h-12 px-5',
        icon: 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
);

function Button({
  className,
  variant = 'default',
  size = 'md',
  asChild = false,
  isLoading = false,
  fullWidth = false,
  title,
  children,
  type = 'button',
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  } & ButtonBaseProps) {
  const Comp = asChild ? Slot : 'button';
  const content = children ?? title;
  const loadingContent = (
    <>
      <span
        aria-hidden="true"
        className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
      />
      <span className="sr-only">{content}</span>
    </>
  );

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      disabled={isLoading || props.disabled}
      className={cn(buttonVariants({ variant, size, className }), fullWidth && 'w-full')}
      type={asChild ? undefined : type}
      {...props}
    >
      {isLoading ? loadingContent : content}
    </Comp>
  );
}

export { Button, buttonVariants };
