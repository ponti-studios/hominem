import type { TransactionListOutput } from '@hominem/rpc/finance';
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight } from 'lucide-react';

import { Currency } from '~/components/design';
import { cn } from '~/lib/utils';

export type FinanceTransactionData = TransactionListOutput['data'][number];

type FinanceTransactionProps = {
  transaction: FinanceTransactionData;
  selected?: boolean;
  entranceIndex?: number;
  suggestion?: string | null;
  queued?: boolean;
  onSelect?: () => void;
  onOpen?: () => void;
};

const transactionGridClass =
  'grid grid-cols-[2rem_minmax(6rem,1fr)_minmax(5.5rem,0.8fr)_10rem] items-center gap-2 sm:grid-cols-[2rem_minmax(12rem,1.3fr)_minmax(8rem,1fr)_11rem] sm:gap-4';

export function FinanceTransactionHeader({
  checked,
  onSelect,
}: {
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      className={`${transactionGridClass} min-h-10 px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:px-4`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onSelect}
        aria-label="Select visible transactions"
        className="size-4 justify-self-center accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      />
      <span>Merchant</span>
      <span>Category</span>
      <span className="w-full text-right">Amount</span>
    </div>
  );
}

export function FinanceTransaction({
  transaction,
  selected = false,
  entranceIndex,
  suggestion,
  queued = false,
  onSelect,
  onOpen,
}: FinanceTransactionProps) {
  const amount = Number(transaction.amount);
  const category = transaction.categoryName || suggestion || 'Uncategorized';
  const isSuggestion = !transaction.categoryName && Boolean(suggestion);
  const Direction =
    transaction.transactionType === 'transfer'
      ? ArrowLeftRight
      : amount < 0
        ? ArrowUpRight
        : ArrowDownLeft;

  return (
    <div
      role="listitem"
      className={cn(
        `${transactionGridClass} group min-h-12 border-b border-border px-3 transition-colors last:border-b-0 hover:bg-muted/40 sm:px-4`,
        entranceIndex !== undefined && 'finance-transaction-enter',
        selected && 'bg-muted/60',
      )}
      data-ledger-enter={entranceIndex}
    >
      {onSelect ? (
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelect}
          aria-label={`Select ${transaction.merchantName || transaction.description || 'transaction'}`}
          className="size-4 justify-self-center accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        />
      ) : (
        <span aria-hidden className="w-4" />
      )}
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className="min-w-0 truncate py-3 text-left text-sm font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          title={transaction.merchantName || transaction.description || 'Transaction'}
        >
          {transaction.merchantName || transaction.description || 'Transaction'}
        </button>
      ) : (
        <span
          className="min-w-0 truncate py-3 text-sm font-medium text-foreground"
          title={transaction.merchantName || transaction.description || 'Transaction'}
        >
          {transaction.merchantName || transaction.description || 'Transaction'}
        </span>
      )}
      <span
        className={cn(
          'min-w-0 truncate text-left text-sm',
          isSuggestion ? 'text-muted-foreground italic' : 'text-muted-foreground',
        )}
        title={isSuggestion ? `Suggested: ${category}` : category}
      >
        {isSuggestion ? `${category} · Suggested` : category}
        {queued ? ' · Queued' : ''}
      </span>
      <span
        className={cn(
          'flex w-full min-w-0 items-center justify-end gap-1 text-right text-sm font-medium text-foreground',
          transaction.excluded && 'text-muted-foreground line-through',
        )}
      >
        <Direction className="size-3 text-muted-foreground sm:hidden" aria-hidden />
        <Currency
          amount={amount}
          currencyCode={transaction.currencyCode}
          className="min-w-0 flex-1"
        />
      </span>
    </div>
  );
}
