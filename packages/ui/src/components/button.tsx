import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "../lib/utils";
import { LoadingSpinner } from "./loading-spinner";

const buttonVariants = cva(
  "void-focus inline-flex !cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md border text-sm font-medium outline-hidden disabled:pointer-events-none disabled:!cursor-default disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 py-2",
  {
    variants: {
      variant: {
        default:
          "void-hover border-transparent bg-primary text-primary-foreground [--void-hover-bg:color-mix(in_srgb,var(--color-primary)_90%,white_10%)] [--void-hover-color:var(--color-primary-foreground)] [--void-hover-border:transparent]",
        destructive:
          "void-hover border-transparent bg-destructive text-destructive-foreground [--void-hover-bg:color-mix(in_srgb,var(--color-destructive)_90%,white_10%)] [--void-hover-color:var(--color-destructive-foreground)] [--void-hover-border:transparent]",
        outline:
          "void-hover border-border bg-surface text-foreground [--void-hover-bg:var(--color-bg-elevated)] [--void-hover-color:var(--color-foreground)] [--void-hover-border:var(--color-border-default)]",
        secondary:
          "void-hover border-transparent bg-secondary text-secondary-foreground [--void-hover-bg:color-mix(in_srgb,var(--color-secondary)_80%,white_20%)] [--void-hover-color:var(--color-secondary-foreground)] [--void-hover-border:transparent]",
        ghost:
          "void-hover border-transparent bg-transparent text-foreground [--void-hover-bg:var(--color-accent)] [--void-hover-color:var(--color-accent-foreground)] [--void-hover-border:transparent]",
        link: "void-hover border-transparent bg-transparent text-foreground underline-offset-4 hover:underline [--void-hover-bg:transparent] [--void-hover-color:var(--color-secondary-foreground)] [--void-hover-border:transparent]",
      },
      size: {
        default: "px-3 text-sm",
        sm: "px-2 text-xs",
        lg: "px-5 text-sm",
        icon: "size-6",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  isLoading?: boolean;
  loadingLabel?: string;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className,
      disabled,
      isLoading = false,
      loadingLabel = "Loading",
      variant,
      size,
      asChild = false,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";
    const spinnerVariant = size === "lg" ? "md" : "sm";

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        style={{
          ...props.style,
          cursor: disabled || isLoading ? "default" : "pointer",
        }}
        type="button"
        ref={ref}
        disabled={disabled || isLoading}
        aria-busy={isLoading}
        {...props}
      >
        {isLoading ? (
          <>
            <LoadingSpinner variant={spinnerVariant} />
            <span className="sr-only">{loadingLabel}</span>
          </>
        ) : (
          children
        )}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
