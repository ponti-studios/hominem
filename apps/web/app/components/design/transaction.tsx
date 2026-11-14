import { Check } from 'lucide-react';

import { cn } from '~/lib/utils';

type TransactionProps = {
  description: React.ReactNode;
  date?: React.ReactNode;
  account?: React.ReactNode;
  category?: React.ReactNode;
  amount: React.ReactNode;
  selected?: boolean;
  onSelect?: () => void;
  selectionPosition?: 'start' | 'end';
  className?: string;
};

/** Common ledger row for transaction lists and review queues. */
export function Transaction({
  description,
  date,
  account,
  category,
  amount,
  selected,
  onSelect,
  selectionPosition = 'end',
  className,
}: TransactionProps) {
  const content = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-foreground">{description}</span>
        {(date || account || category) && (
          <span className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
            {date && <span>{date}</span>}
            {account && <span>{account}</span>}
            {category && <span>{category}</span>}
          </span>
        )}
      </span>
      <span className="shrink-0 text-right text-sm font-medium tabular-nums text-foreground">
        {amount}
      </span>
      {onSelect && (
        <span
          aria-hidden="true"
          className={cn(
            'flex size-4 shrink-0 items-center justify-center rounded-sm border border-border',
            selectionPosition === 'start' && '-order-1',
            selected && 'border-primary bg-primary text-primary-foreground',
          )}
        >
          {selected && <Check className="size-3" />}
        </span>
      )}
    </>
  );

  const rowClassName = cn(
    'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60 sm:px-5',
    selected && 'bg-muted',
    className,
  );

  return onSelect ? (
    <button
      type="button"
      aria-pressed={Boolean(selected)}
      className={rowClassName}
      onClick={onSelect}
    >
      {content}
    </button>
  ) : (
    <div role="listitem" className={rowClassName}>
      {content}
    </div>
  );
}
