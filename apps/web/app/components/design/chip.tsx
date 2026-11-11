import { X } from 'lucide-react';

import { cn } from '~/lib/utils';

type ChipProps = {
  children: React.ReactNode;
  onRemove?: () => void;
  removeLabel?: string;
  className?: string;
};

/** Removable pill. Skills, tech stacks, selected engagements, active filters. */
export function Chip({ children, onRemove, removeLabel = 'Remove', className }: ChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13px]',
        'border-border bg-muted text-foreground',
        className,
      )}
    >
      {children}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel}
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          <X aria-hidden className="size-3.5" />
        </button>
      ) : null}
    </span>
  );
}
