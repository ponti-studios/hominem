import { Slot } from '@radix-ui/react-slot';
import type { ComponentPropsWithoutRef, ElementType, HTMLAttributes, ReactNode } from 'react';

import { cn } from '../../lib/utils';

type PreviewCardRootProps<T extends ElementType = 'div'> = {
  as?: T;
  asChild?: boolean;
  interactive?: boolean;
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'className'>;

function PreviewCardRoot<T extends ElementType = 'div'>({
  as,
  asChild = false,
  interactive = false,
  ...props
}: PreviewCardRootProps<T>) {
  const Comp = asChild ? Slot : (as ?? 'div');

  return (
    <Comp
      className={cn(
        'block rounded-3xl border-subtle bg-surface p-5',
        interactive && 'transition-colors hover:border-foreground/30',
      )}
      {...props}
    />
  );
}

export interface PreviewCardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  meta?: ReactNode;
}

function PreviewCardHeader({ meta, children, ...props }: PreviewCardHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-5" {...props}>
      <div className="min-w-0 flex-1">{children}</div>
      {meta ? <div className="shrink-0 text-right text-xs text-text-tertiary">{meta}</div> : null}
    </div>
  );
}

function PreviewCardTitle(props: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className="text-base font-semibold text-foreground" {...props} />;
}

function PreviewCardDescription(props: HTMLAttributes<HTMLParagraphElement>) {
  return <p className="mt-2 text-sm leading-6 text-text-secondary" {...props} />;
}

function PreviewCardFooter(props: HTMLAttributes<HTMLDivElement>) {
  return <div className="mt-3 flex items-center gap-2" {...props} />;
}

export const PreviewCard = Object.assign(PreviewCardRoot, {
  Header: PreviewCardHeader,
  Title: PreviewCardTitle,
  Description: PreviewCardDescription,
  Footer: PreviewCardFooter,
});
