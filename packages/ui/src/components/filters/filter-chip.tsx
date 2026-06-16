import { X } from 'lucide-react';

import { Button } from '../button';

interface FilterChipProps {
  label: string;
  onRemove: () => void;
  onClick?: (() => void) | undefined; // Reserved for future "edit filter" functionality
}

export function FilterChip({ label, onRemove, onClick }: FilterChipProps) {
  return (
    <div
      className="void-hover void-focus flex items-center gap-1 bg-muted px-2 py-1 text-xs text-muted-foreground [--void-hover-bg:color-mix(in_srgb,var(--color-muted-foreground)_10%,transparent)] [--void-hover-color:var(--color-foreground)] [--void-hover-border:transparent]"
      title={onClick ? `Click to edit: ${label}` : label}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <span>{label}</span>
      <Button
        variant="ghost"
        size="icon"
        className="[--void-hover-bg:color-mix(in_srgb,var(--color-muted-foreground)_20%,transparent)] [--void-hover-color:var(--color-foreground)]"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        aria-label={`Remove filter: ${label}`}
      >
        <X className="size-3" />
      </Button>
    </div>
  );
}
