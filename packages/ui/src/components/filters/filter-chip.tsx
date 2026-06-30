import { X } from "lucide-react";

export interface FilterChipProps {
  label: string;
  onRemove: () => void;
  onClick?: () => void;
}

export function FilterChip({ label, onRemove, onClick }: FilterChipProps) {
  return (
    <div
      className="focus-visible:ring-ring border-border bg-elevated text-foreground flex items-center gap-1 rounded-full border px-2 py-1 text-sm font-medium transition-colors hover:bg-[var(--color-bg-elevated)] focus-visible:ring-2 focus-visible:outline-none"
      title={onClick ? `Click to edit: ${label}` : label}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick?.();
        }
      }}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <span>{label}</span>
      <button
        type="button"
        className="focus-visible:ring-ring rounded-full p-0.5 opacity-50 transition-opacity hover:opacity-100 focus-visible:ring-2 focus-visible:outline-none"
        onClick={(event) => {
          event.stopPropagation();
          onRemove();
        }}
        aria-label={`Remove filter: ${label}`}
      >
        <X className="size-3" />
      </button>
    </div>
  );
}
