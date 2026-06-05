import * as TabsPrimitive from '@radix-ui/react-tabs';
import * as React from 'react';

import { cn } from '../lib/utils';

function Tabs({ ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root data-slot="tabs" {...props} />;
}

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        'inline-flex h-9 items-center justify-center rounded-lg border border-border bg-secondary/40 p-1 text-secondary-foreground',
        className,
      )}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        'inline-flex min-h-6 items-center justify-center whitespace-nowrap rounded-md border border-transparent px-3 py-1 text-sm font-medium text-secondary-foreground transition-all focus-visible:outline-none focus-visible:border-foreground focus-visible:bg-accent/40 focus-visible:text-foreground disabled:pointer-events-none disabled:opacity-50 data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-foreground',
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn(
        'mt-2 rounded-md focus-visible:outline-none focus-visible:border focus-visible:border-border focus-visible:bg-accent/10',
        className,
      )}
      {...props}
    />
  );
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
