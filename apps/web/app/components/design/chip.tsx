import { X } from 'lucide-react';

import { cn } from '~/lib/utils';

type ChipProps = {
  children: React.ReactNode;
  onRemove?: () => void;
  removeLabel?: string;
  tone?: 'default' | 'volt';
  className?: string;
};

/** Removable pill. Skills, tech stacks, selected engagements, active filters. */
export function Chip({
  children,
  onRemove,
  removeLabel = 'Remove',
  tone = 'default',
  className,
}: ChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13px]',
        tone === 'volt'
          ? 'border-[#d7ff3e]/40 bg-[#d7ff3e]/10 text-[#f2f4f8]'
          : 'border-white/10 bg-white/[0.04] text-[#f2f4f8]',
        className,
      )}
    >
      {children}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel}
          className="text-[#9ba3b4] transition-colors hover:text-[#f2f4f8]"
        >
          <X aria-hidden className="size-3.5" />
        </button>
      ) : null}
    </span>
  );
}
