import * as CollapsiblePrimitive from '@radix-ui/react-collapsible';
import { ChevronDown } from 'lucide-react';
import {
  Children,
  isValidElement,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from 'react';

import { cn } from '../lib/utils';

type CollapsibleRootProps = Omit<
  ComponentProps<typeof CollapsiblePrimitive.Root>,
  'children'
> & {
  children:
    | ReactElement<CollapsibleTriggerProps, typeof CollapsibleTrigger>
    | ReactElement<CollapsibleContentProps, typeof CollapsibleContent>
    | Array<
        | ReactElement<CollapsibleTriggerProps, typeof CollapsibleTrigger>
        | ReactElement<CollapsibleContentProps, typeof CollapsibleContent>
      >;
};

function Collapsible({ children, ...props }: CollapsibleRootProps) {
  if (process.env.NODE_ENV !== 'production') {
    Children.forEach(children, (child) => {
      if (!isValidElement(child)) {
        throw new Error('Collapsible only accepts CollapsibleTrigger and CollapsibleContent.');
      }

      if (child.type !== CollapsibleTrigger && child.type !== CollapsibleContent) {
        throw new Error('Collapsible only accepts CollapsibleTrigger and CollapsibleContent.');
      }
    });
  }

  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props}>{children}</CollapsiblePrimitive.Root>;
}

interface CollapsibleTriggerProps
  extends Omit<ComponentProps<typeof CollapsiblePrimitive.CollapsibleTrigger>, 'children'> {
  text?: ReactNode;
  icon?: ReactNode;
  children?: ReactNode;
}

function CollapsibleTrigger({ text, icon, children, className, ...props }: CollapsibleTriggerProps) {
  return (
    <CollapsiblePrimitive.CollapsibleTrigger
      data-slot="collapsible-trigger"
      className={cn(
        'group flex w-full items-center justify-between gap-4 border border-accent rounded-md px-4 py-3 text-left text-sm font-semibold transition-colors hover:bg-accent hover:text-accent-foreground [&[data-state=open]>svg]:rotate-180',
        className,
      )}
      {...props}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2 truncate">
        {icon}
        {children ?? text}
      </span>
      <ChevronDown
        className="size-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180"
        aria-hidden="true"
      />
    </CollapsiblePrimitive.CollapsibleTrigger>
  );
}

type CollapsibleContentProps = Omit<
  ComponentProps<typeof CollapsiblePrimitive.CollapsibleContent>,
  never
>;

function CollapsibleContent({ children, className, ...props }: CollapsibleContentProps) {
  return (
    <CollapsiblePrimitive.CollapsibleContent
      data-slot="collapsible-content"
      className={cn('space-y-2 p-2', className)}
      {...props}
    >
      {children}
    </CollapsiblePrimitive.CollapsibleContent>
  );
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
