import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';

import { cn } from '~/lib/utils';

type RowLinkProps = {
  to: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badges?: React.ReactNode;
  leading?: React.ReactNode;
  /** Right-side secondary content (dates, counts). */
  meta?: React.ReactNode;
  /** Right-side primary content (amounts, totals). */
  trailing?: React.ReactNode;
  chevron?: boolean;
  className?: string;
};

/**
 * The universal list row. Tasks, collections, accounts, and (later)
 * career collections all render this: title + badges + subtitle on the
 * left, meta + trailing + chevron on the right. Lives inside a `List`.
 */
export function RowLink({
  to,
  title,
  subtitle,
  badges,
  leading,
  meta,
  trailing,
  chevron = true,
  className,
}: RowLinkProps) {
  return (
    <Link
      to={to}
      viewTransition
      className={cn(
        'group flex items-center justify-between gap-4 px-4 py-3.5 transition-colors duration-150 hover:bg-white/[0.03] sm:px-5',
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {leading}
          <span className="truncate font-medium text-[#f2f4f8]">{title}</span>
          {badges}
        </div>
        {subtitle ? <p className="mt-0.5 truncate text-sm text-[#9ba3b4]">{subtitle}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-3 text-[13px] text-[#9ba3b4] tabular-nums">
        {meta}
        {trailing}
        {chevron ? (
          <ChevronRight
            aria-hidden
            className="size-4 text-[#5e6678] transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-[#d7ff3e]"
          />
        ) : null}
      </div>
    </Link>
  );
}

type ListProps = {
  children: React.ReactNode;
  variant?: 'divided' | 'spaced';
  ariaLabel?: string;
  className?: string;
};

/** List container for RowLinks: hairline dividers or spaced cards. */
export function List({ children, variant = 'divided', ariaLabel, className }: ListProps) {
  if (variant === 'spaced') {
    return (
      <ul aria-label={ariaLabel} className={cn('flex flex-col gap-2.5', className)}>
        {children}
      </ul>
    );
  }
  return (
    <ul aria-label={ariaLabel} className={cn('divide-y divide-white/[0.06]', className)}>
      {children}
    </ul>
  );
}
