import { EmptyState } from '@ponti-studios/ui/feedback';
import { Skeleton } from '@ponti-studios/ui/feedback';
import { Receipt } from 'lucide-react';

import { List } from '~/components/design';
import { FinanceTransaction } from '~/modules/finance/components/transactions/finance-transaction';
import type { useFinanceTransactions } from '~/modules/finance/hooks/use-finance-data';

type TransactionFromAPI = ReturnType<typeof useFinanceTransactions>['transactions'][number];

type TransactionsListProps = {
  loading: boolean;
  error: string | null;
  transactions: TransactionFromAPI[];
  variant?: 'card' | 'divided';
};

export function TransactionsList({
  loading,
  error,
  transactions,
  variant = 'card',
}: TransactionsListProps) {
  if (loading) {
    return (
      <List.Items as="div" ariaLabel="Transactions" variant={variant}>
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={`tx-skeleton-${i}`}
            role="listitem"
            className="flex h-12 items-center justify-between gap-4 border-b border-border px-4 last:border-b-0 sm:px-5"
          >
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </List.Items>
    );
  }

  if (error) {
    return (
      <EmptyState
        variant="dashed"
        title="Couldn’t load transactions"
        description={error}
        icon={<Receipt className="size-5" aria-hidden />}
      />
    );
  }

  if (transactions.length === 0) {
    return (
      <EmptyState
        variant="search"
        title="No transactions found"
        description="Try adjusting your filters or date range."
        icon={<Receipt className="size-5" aria-hidden />}
      />
    );
  }

  return (
    <List.Items as="div" ariaLabel="Transactions" variant={variant}>
      {transactions.map((transaction) => (
        <FinanceTransaction key={transaction.id} transaction={transaction} />
      ))}
    </List.Items>
  );
}
