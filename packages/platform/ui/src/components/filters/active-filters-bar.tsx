import { FilterChip } from './filter-chip';

export interface ActiveFilter {
  id: string;
  label: string;
  onRemove: () => void;
  onClick?: () => void;
}

interface ActiveFiltersBarProps {
  filters: ActiveFilter[];
  label?: string;
}

export function ActiveFiltersBar({ filters, label }: ActiveFiltersBarProps) {
  if (filters.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {label && <span className="text-sm text-muted-foreground">{label}</span>}
      {filters.map((filter) => (
        <FilterChip
          key={filter.id}
          label={filter.label}
          onRemove={filter.onRemove}
          onClick={filter.onClick}
        />
      ))}
    </div>
  );
}
