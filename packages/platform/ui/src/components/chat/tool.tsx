import { Wrench } from 'lucide-react';
import { type HTMLAttributes, type ReactNode, useState } from 'react';

import { cn } from '../../lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../collapsible';
import { LoadingSpinner } from '../loading-spinner';

interface ToolProps extends HTMLAttributes<HTMLDivElement> {
  name: string;
  status?: 'pending' | 'running' | 'completed' | 'error';
  isOpen?: boolean;
}

export function Tool({
  name,
  status = 'pending',
  isOpen: defaultOpen = true,
  children,
  className,
  ...props
}: ToolProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const statusColors = {
    pending: 'bg-muted text-muted-foreground',
    running: 'bg-accent/10 text-accent border-accent/20',
    completed: 'bg-success/10 text-success border-success/20',
    error: 'bg-destructive/10 text-destructive border-destructive/20',
  };

  const statusIcons = {
    pending: <Wrench className="size-4" />,
    running: <LoadingSpinner variant="sm" />,
    completed: <span className="text-success">✓</span>,
    error: <span className="text-destructive">✗</span>,
  };

  return (
    <div className={cn('rounded-md border', statusColors[status], 'px-3', className)} {...props}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger
          icon={statusIcons[status]}
          text={name}
          className="gap-2 border-transparent bg-transparent px-0 py-2 text-inherit hover:bg-transparent hover:text-inherit"
        />

        <CollapsibleContent className="px-0 pb-3 pt-0">{children}</CollapsibleContent>
      </Collapsible>
    </div>
  );
}

interface ToolHeaderProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function ToolHeader({ children, className, ...props }: ToolHeaderProps) {
  return (
    <div className={cn('font-medium text-sm', className)} {...props}>
      {children}
    </div>
  );
}

interface ToolInputProps extends HTMLAttributes<HTMLPreElement> {
  children?: string;
}

export function ToolInput({ children, className, ...props }: ToolInputProps) {
  if (!children) return null;

  return (
    <pre
      className={cn('mt-2 overflow-x-auto rounded bg-muted/50 p-2 text-xs font-mono', className)}
      {...props}
    >
      {children}
    </pre>
  );
}

interface ToolOutputProps extends HTMLAttributes<HTMLPreElement> {
  children?: string;
  isError?: boolean;
}

export function ToolOutput({ children, isError = false, className, ...props }: ToolOutputProps) {
  if (!children) return null;

  return (
    <pre
      className={cn(
        'mt-2 overflow-x-auto rounded bg-muted/50 p-2 text-xs font-mono',
        isError && 'text-destructive',
        className,
      )}
      {...props}
    >
      {children}
    </pre>
  );
}
