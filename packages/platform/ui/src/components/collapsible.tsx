import * as CollapsiblePrimitive from '@radix-ui/react-collapsible';
import { ChevronDown } from 'lucide-react';
import { Children, isValidElement, type ComponentProps, type ReactElement } from 'react';

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
  extends Omit<ComponentProps<typeof CollapsiblePrimitive.CollapsibleTrigger>, 'className' | 'children'> {
  text: string;
}

function CollapsibleTrigger({ text, ...props }: CollapsibleTriggerProps) {
  return (
    <CollapsiblePrimitive.CollapsibleTrigger
      data-slot="collapsible-trigger"
      className="group flex w-full items-center justify-between gap-4 border border-accent rounded-md px-4 py-3 text-left text-sm font-semibold transition-colors hover:bg-accent hover:text-accent-foreground [&[data-state=open]>svg]:rotate-180"
      {...props}
    >
      <span className="min-w-0 flex-1 truncate">{text}</span>
      <ChevronDown className="size-4 shrink-0 transition-transform duration-200" aria-hidden="true" />
    </CollapsiblePrimitive.CollapsibleTrigger>
  );
}

type CollapsibleContentProps = Omit<
  ComponentProps<typeof CollapsiblePrimitive.CollapsibleContent>,
  'className'
>;

function CollapsibleContent({ children, ...props }: CollapsibleContentProps) {
  return (
    <CollapsiblePrimitive.CollapsibleContent
      data-slot="collapsible-content"
      className="space-y-2 p-2"
      {...props}
    >
      {children}
    </CollapsiblePrimitive.CollapsibleContent>
  );
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
