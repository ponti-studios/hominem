import { Search, X } from 'lucide-react';

import { cn } from '~/lib/utils';

type SearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel: string;
  onClear?: () => void;
  className?: string;
  inputClassName?: string;
  ref?: React.Ref<HTMLInputElement>;
};

/**
 * Search field with icon affordance and optional clear button. Replaces
 * the hand-rolled search inputs in filter bars.
 */
export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  ariaLabel,
  onClear,
  className,
  inputClassName,
  ref,
}: SearchInputProps) {
  return (
    <div className={cn('relative', className)}>
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <input
        ref={ref}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={cn(
          'h-10 w-full rounded-sm border border-border bg-muted pr-9 pl-9 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring [&::-webkit-search-cancel-button]:hidden',
          inputClassName,
        )}
      />
      {value && onClear ? (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear search"
          className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X aria-hidden className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}
