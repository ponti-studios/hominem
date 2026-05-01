import { Sparkles } from 'lucide-react';
import { useState, type HTMLAttributes, type ReactNode } from 'react';

import { cn } from '../../lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../collapsible';

interface ReasoningProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  isOpen?: boolean;
}

export function Reasoning({
  children,
  isOpen: defaultOpen = false,
  className,
  ...props
}: ReasoningProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={cn('rounded-md border bg-muted/50 px-3', className)} {...props}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger
          icon={<Sparkles className="size-4" />}
          text="AI Thinking"
          className="gap-2 border-transparent bg-transparent px-0 py-2 text-muted-foreground hover:bg-transparent hover:text-foreground"
        />
        <CollapsibleContent className="px-0 pb-3 pt-0">
          <div className="text-sm whitespace-pre-wrap leading-relaxed opacity-80">{children}</div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

interface ReasoningContentProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function ReasoningContent({ children, className, ...props }: ReasoningContentProps) {
  return (
    <div className={cn('text-sm whitespace-pre-wrap leading-relaxed', className)} {...props}>
      {children}
    </div>
  );
}
