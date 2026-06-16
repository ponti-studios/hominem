import { X } from 'lucide-react';

interface FilterChipProps {
  label: string;
  onRemove: () => void;
  onClick?: (() => void) | undefined; // Reserved for future "edit filter" functionality
}

export function FilterChip({ label, onRemove, onClick }: FilterChipProps) {
  return (
    <div
      className="flex items-center gap-1 rounded-full border border-border/40 bg-card px-2 py-1 text-sm font-medium text-card-foreground transition-colors hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
      <button
        type="button"
        className="rounded-full p-0.5 opacity-50 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        aria-label={`Remove filter: ${label}`}
      >
        <X className="size-3" />
      </button>
    </div>
  );
}
