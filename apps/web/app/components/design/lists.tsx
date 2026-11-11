import { ChevronLeft, ChevronRight } from 'lucide-react';
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
 * left, meta + trailing + chevron on the right. Lives inside `List.Items`.
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
        'group flex items-center justify-between gap-4 px-4 py-3.5 transition-colors duration-150 hover:bg-muted sm:px-5',
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {leading}
          <span className="truncate font-medium text-foreground">{title}</span>
          {badges}
        </div>
        {subtitle ? (
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-3 text-[13px] text-muted-foreground tabular-nums">
        {meta}
        {trailing}
        {chevron ? (
          <ChevronRight
            aria-hidden
            className="size-4 text-muted-foreground transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-foreground"
          />
        ) : null}
      </div>
    </Link>
  );
}

type ListItemsProps = {
  children: React.ReactNode;
  variant?: 'divided' | 'spaced' | 'card';
  ariaLabel?: string;
  className?: string;
  as?: 'div' | 'ul';
};

function ListItems({
  children,
  variant = 'divided',
  ariaLabel,
  className,
  as = 'ul',
}: ListItemsProps) {
  const itemsClassName = cn(
    as === 'ul' && variant === 'spaced' && 'flex flex-col gap-2.5',
    as === 'ul' && variant === 'divided' && 'divide-y divide-border',
    variant === 'card' && 'overflow-hidden rounded-3xl border border-border bg-surface shadow-xs',
    className,
  );

  if (as === 'ul') {
    return (
      <ul aria-label={ariaLabel} className={itemsClassName}>
        {children}
      </ul>
    );
  }

  return (
    <div aria-label={ariaLabel} role={ariaLabel ? 'list' : undefined} className={itemsClassName}>
      {children}
    </div>
  );
}

function ListSearch({
  children,
  className,
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div
      id={id}
      className={cn('flex flex-col gap-3 border-b border-border bg-muted/30 p-4', className)}
    >
      {children}
    </div>
  );
}

function ListPagination({
  currentPage,
  totalPages,
  onPageChange,
  summary,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  summary?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
      {summary ? <span>{summary}</span> : <span />}
      {totalPages > 1 ? (
        <nav aria-label="List pagination" className="flex items-center gap-2">
          <span className="tabular-nums">
            Page {currentPage + 1} of {totalPages}
          </span>
          <button
            aria-label="Previous page"
            className="hairline flex size-8 items-center justify-center rounded-sm disabled:opacity-40"
            disabled={currentPage <= 0}
            onClick={() => onPageChange(currentPage - 1)}
            type="button"
          >
            <ChevronLeft aria-hidden className="size-4" />
          </button>
          <button
            aria-label="Next page"
            className="hairline flex size-8 items-center justify-center rounded-sm disabled:opacity-40"
            disabled={currentPage >= totalPages - 1}
            onClick={() => onPageChange(currentPage + 1)}
            type="button"
          >
            <ChevronRight aria-hidden className="size-4" />
          </button>
        </nav>
      ) : null}
    </div>
  );
}

function ListRoot({
  children,
  className,
  variant = 'grouped',
}: {
  children: React.ReactNode;
  className?: string;
  variant?: 'grouped' | 'plain';
}) {
  return (
    <div
      className={cn(
        variant === 'grouped' && 'flex flex-col overflow-hidden rounded-xl border border-border',
        variant === 'plain' && 'flex flex-col gap-4',
        className,
      )}
    >
      {children}
    </div>
  );
}

export const List = Object.assign(ListRoot, {
  Search: ListSearch,
  Items: ListItems,
  Pagination: ListPagination,
});
