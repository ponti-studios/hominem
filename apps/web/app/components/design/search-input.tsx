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
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#5e6678]"
      />
      <input
        ref={ref}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={cn(
          'h-10 w-full rounded-xl border border-white/10 bg-white/[0.04] pr-9 pl-9 text-sm text-[#f2f4f8] outline-none transition-colors placeholder:text-[#5e6678] focus:border-[#d7ff3e]/60 [&::-webkit-search-cancel-button]:hidden',
          inputClassName,
        )}
      />
      {value && onClear ? (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear search"
          className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-[#9ba3b4] transition-colors hover:bg-white/[0.08] hover:text-[#f2f4f8]"
        >
          <X aria-hidden className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}
