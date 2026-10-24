import type {
  AccountAllOutput,
  AccountGetOutput,
  AccountListOutput,
  AccountWithTransactions,
  InstitutionsListOutput,
  TransactionListOutput,
} from '@hominem/rpc/finance';
import type { SortOption } from '@ponti-studios/ui/hooks';
import { format } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';

import { useHonoQuery } from '~/lib/api';

type RawAccountWithTransactions = {
  id: string;
  userId: string;
  name: string;
  accountType: AccountWithTransactions['accountType'];
  currentBalance: number | null;
  transactions: AccountWithTransactions['transactions'];
};

function normalizeAccountWithTransactions(
  account: RawAccountWithTransactions,
): AccountWithTransactions {
  const normalized: AccountWithTransactions = {
    id: account.id,
    userId: account.userId,
    name: account.name,
    accountType: account.accountType,
    currentBalance: account.currentBalance,
    transactions: account.transactions,
  };

  return normalized;
}

export interface FilterArgs {
  accountId?: string | undefined;
  accountIds?: string[] | undefined;
  dateFrom?: Date | undefined;
  dateTo?: Date | undefined;
  description?: string | undefined;
}

interface UseFinanceAccountsOptions {
  initialData?: AccountListOutput;
}

export const useFinanceAccounts = ({ initialData }: UseFinanceAccountsOptions = {}) => {
  const { data, isLoading, error, refetch } = useHonoQuery<AccountListOutput>(
    ['finance', 'accounts', 'list'],
    ({ finance }) =>
      finance.accounts.list.$get({ query: { includeInactive: 'false' } }).then((r) => r.json()),
    initialData ? { initialData } : {},
  );

  const accountsData = data?.accounts ?? [];

  const accountsMap = useMemo(() => {
    return new Map(accountsData.map((account) => [account.id, account]));
  }, [accountsData]);

  return {
    data,
    isLoading,
    error,
    refetch,
    accountsMap,
  };
};

export const useFinancialInstitutions = () =>
  useHonoQuery<InstitutionsListOutput>(['finance', 'institutions', 'list'], ({ finance }) =>
    finance.institutions.list
      .$get({ query: {} })
      .then((r: { json: () => Promise<InstitutionsListOutput> }) => r.json()),
  );

export function useAllAccounts(options?: { initialData?: AccountAllOutput }) {
  const allAccountsQuery = useHonoQuery<AccountAllOutput>(
    ['finance', 'accounts', 'all'],
    async ({ finance }) => {
      const data = await finance.accounts.all.$get({ query: {} }).then((r) => r.json());
      return {
        ...data,
        accounts: data.accounts.map((account) => normalizeAccountWithTransactions(account)),
      };
    },
    options?.initialData ? { initialData: options.initialData } : {},
  );

  const result = allAccountsQuery.data;

  return {
    isLoading: allAccountsQuery.isLoading,
    error: allAccountsQuery.error,
    refetch: allAccountsQuery.refetch,
    accounts: (result?.accounts ?? []).map(normalizeAccountWithTransactions),
  };
}

export function useAccountById(id: string, options?: { initialData?: AccountGetOutput }) {
  const accountQuery = useHonoQuery<AccountGetOutput>(
    ['finance', 'accounts', 'get', id],
    async ({ finance }) => {
      const data = await finance.accounts.get.$get({ query: { id } }).then((r) => r.json());
      return normalizeAccountWithTransactions(data);
    },
    {
      enabled: !!id,
      ...(options?.initialData ? { initialData: options.initialData } : {}),
    },
  );

  const account = accountQuery.data;

  return {
    ...accountQuery,
    account: account ? normalizeAccountWithTransactions(account) : undefined,
  };
}

interface UseFinanceTransactionsOptions {
  filters?: FilterArgs;
  sortOptions?: SortOption[];
  page?: number;
  limit?: number;
  initialData?: TransactionListOutput;
}

export function useFinanceTransactions({
  filters = {},
  sortOptions = [{ field: 'date', direction: 'desc' }],
  page = 0,
  limit = 25,
  initialData,
}: UseFinanceTransactionsOptions = {}) {
  const sortBy = useMemo(() => {
    return sortOptions[0]?.field || 'date';
  }, [sortOptions]);

  const sortOrder: 'asc' | 'desc' = useMemo(() => {
    return sortOptions[0]?.direction || 'desc';
  }, [sortOptions]);

  const queryOptions: { staleTime: number; initialData?: TransactionListOutput } = {
    staleTime: 1 * 60 * 1000,
  };

  const isInitialQuery =
    page === 0 &&
    !filters.accountId &&
    !filters.accountIds?.length &&
    !filters.dateFrom &&
    !filters.dateTo &&
    !filters.description &&
    sortBy === 'date' &&
    sortOrder === 'desc';

  if (initialData && isInitialQuery) {
    queryOptions.initialData = initialData;
  }

  // Keyset paging has no random access: page N's cursor is the `nextCursor` the server issued for
  // page N-1. This stack belongs to one filter combination and resets when the filters change.
  const filterKey = useMemo(
    () => JSON.stringify([filters, sortBy, sortOrder, limit]),
    [filters, sortBy, sortOrder, limit],
  );
  const [pagination, setPagination] = useState<{ key: string; cursors: (string | null)[] }>({
    key: filterKey,
    cursors: [null],
  });
  if (pagination.key !== filterKey) {
    setPagination({ key: filterKey, cursors: [null] });
  }
  const cursor = pagination.cursors[page] ?? undefined;

  const query = useHonoQuery<TransactionListOutput>(
    [
      'finance',
      'transactions',
      'list',
      {
        filters,
        sortBy,
        sortOrder,
        cursor,
        limit,
      },
    ],
    ({ finance }) =>
      finance.transactions.list
        .$get({
          query: {
            ...(filters.dateFrom ? { dateFrom: format(filters.dateFrom, 'yyyy-MM-dd') } : {}),
            ...(filters.dateTo ? { dateTo: format(filters.dateTo, 'yyyy-MM-dd') } : {}),
            ...(filters.accountIds && filters.accountIds.length > 0
              ? { accountIds: filters.accountIds }
              : filters.accountId && filters.accountId !== 'all'
                ? { account: filters.accountId }
                : {}),
            ...(filters.description ? { description: filters.description } : {}),
            limit: String(limit),
            ...(cursor ? { cursor } : {}),
            sortBy,
            sortDirection: sortOrder,
          },
        })
        .then((r) => r.json()),
    { ...queryOptions, enabled: page === 0 || cursor !== undefined },
  );

  const result = query.data;
  const nextCursor = result?.nextCursor;

  useEffect(() => {
    if (nextCursor === undefined) return;
    setPagination((prev) => {
      if (prev.key !== filterKey || prev.cursors[page + 1] === nextCursor) return prev;
      return { key: prev.key, cursors: [...prev.cursors.slice(0, page + 1), nextCursor] };
    });
  }, [nextCursor, page, filterKey]);

  return {
    transactions: Array.isArray(result?.data) ? result.data : [],
    totalTransactions: result?.filteredCount ?? 0,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
