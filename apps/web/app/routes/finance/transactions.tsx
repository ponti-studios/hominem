import { useApiClient } from '@hominem/rpc/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, Ellipsis, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

import {
  CurrencyField,
  PageHeader,
  SelectField,
  TextAreaInput,
  TextInput,
} from '~/components/design';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import {
  FinanceTransaction,
  FinanceTransactionHeader,
  type FinanceTransactionData,
} from '~/modules/finance/components/transactions/finance-transaction';
import { useFinanceAccounts } from '~/modules/finance/hooks/use-finance-data';

type StatusFilter = 'all' | 'uncategorized' | 'excluded' | 'queued';
type TransactionTypeFilter = '' | 'income' | 'expense' | 'transfer';
type BatchAction =
  | { action: 'category'; categoryId: string; tagIds?: string[] }
  | { action: 'tags'; tagIds: string[] }
  | { action: 'merchant' | 'notes'; value: string | null }
  | { action: 'exclude' | 'restore' | 'delete' }
  | { action: 'move'; accountId: string };

function toStatusFilter(value: string): StatusFilter {
  return value === 'uncategorized' || value === 'excluded' || value === 'queued' ? value : 'all';
}

function toTransactionTypeFilter(value: string): TransactionTypeFilter {
  return value === 'income' || value === 'expense' || value === 'transfer' ? value : '';
}

function normalizeMerchant(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/^(?:sq\s*\*|tst\s*\*)\s*/i, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function FinanceTransactionsPage() {
  const reduceMotion = useReducedMotion();
  const client = useApiClient();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get('search') ?? '';
  const accountId = searchParams.get('account') ?? '';
  const categoryName = searchParams.get('category') ?? '';
  const tagId = searchParams.get('tag') ?? '';
  const transactionType = toTransactionTypeFilter(searchParams.get('type') ?? '');
  const dateFrom = searchParams.get('from') ?? '';
  const dateTo = searchParams.get('to') ?? '';
  const amountMin = searchParams.get('min') ?? '';
  const amountMax = searchParams.get('max') ?? '';
  const status = toStatusFilter(searchParams.get('status') ?? 'all');
  const focusedTransactionId = searchParams.get('transactionId') ?? '';
  const [cursor, setCursor] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [activeTransaction, setActiveTransaction] = useState<FinanceTransactionData | null>(null);
  const [dismissedTransactionId, setDismissedTransactionId] = useState('');
  const [categoryChoice, setCategoryChoice] = useState('');
  const [tagChoice, setTagChoice] = useState('');
  const [bulkDialog, setBulkDialog] = useState<'merchant' | 'notes' | 'tags' | 'move' | null>(null);
  const [bulkValue, setBulkValue] = useState('');
  const [drawerCategoryId, setDrawerCategoryId] = useState('');
  const [drawerMerchant, setDrawerMerchant] = useState('');
  const [drawerDescription, setDrawerDescription] = useState('');
  const [drawerAmount, setDrawerAmount] = useState('');
  const [drawerDate, setDrawerDate] = useState('');
  const [drawerNotes, setDrawerNotes] = useState('');
  const [drawerAccountId, setDrawerAccountId] = useState('');
  const [selectAllError, setSelectAllError] = useState('');

  const filters = {
    search,
    accountId,
    categoryName,
    tagId,
    transactionType,
    dateFrom,
    dateTo,
    amountMin,
    amountMax,
    status,
  };
  const filterKey = searchParams.toString();
  const queue = useQuery({
    queryKey: ['finance', 'rulings', 'queue'],
    queryFn: async () => {
      const response = await client.api.finance.rulings.queue.$get();
      if (!response.ok) throw new Error('Unable to load queued decisions.');
      return response.json();
    },
  });
  const options = useQuery({
    queryKey: ['finance', 'transactions', 'options'],
    queryFn: async () => {
      const response = await client.api.finance.transactions.options.$get();
      if (!response.ok) throw new Error('Unable to load transaction options.');
      return response.json();
    },
  });
  const rulebook = useQuery({
    queryKey: ['finance', 'rulings', 'current'],
    queryFn: async () => {
      const response = await client.api.finance.rulings.current.$get();
      if (!response.ok) throw new Error('Unable to load category suggestions.');
      return response.json();
    },
  });
  const { accountsMap } = useFinanceAccounts();
  const accounts = [...(accountsMap?.values() ?? [])];
  const queuedById = useMemo(() => {
    const result = new Map<string, string>();
    for (const verdict of queue.data?.verdicts ?? []) {
      for (const row of verdict.rows) result.set(row.id, verdict.status);
    }
    return result;
  }, [queue.data]);
  const queuedIds = useMemo(
    () => [...queuedById.entries()].filter(([, value]) => value === 'queued').map(([id]) => id),
    [queuedById],
  );
  const transactionQuery = useQuery({
    queryKey: [
      'finance',
      'transactions',
      'ledger',
      filters,
      cursor,
      focusedTransactionId,
      status === 'queued' ? queuedIds : [],
    ],
    queryFn: async () => {
      const response = await client.api.finance.transactions.list.$get({
        query: {
          limit: '50',
          ...(cursor ? { cursor } : {}),
          ...(search.trim() ? { search: search.trim() } : {}),
          ...(accountId ? { account: accountId } : {}),
          ...(categoryName ? { categoryName } : {}),
          ...(tagId ? { tagIds: tagId } : {}),
          ...(transactionType ? { transactionType } : {}),
          ...(dateFrom ? { dateFrom } : {}),
          ...(dateTo ? { dateTo } : {}),
          ...(amountMin ? { min: amountMin } : {}),
          ...(amountMax ? { max: amountMax } : {}),
          ...(status === 'uncategorized' ? { uncategorizedOnly: 'true' as const } : {}),
          ...(status === 'excluded' ? { excluded: 'true' as const } : {}),
          ...(status === 'queued' && queuedIds.length ? { transactionIds: queuedIds } : {}),
        },
      });
      if (!response.ok) throw new Error('Unable to load transactions.');
      return response.json();
    },
    enabled: focusedTransactionId.length > 0 || status !== 'queued' || queuedIds.length > 0,
  });
  const transactions = transactionQuery.data?.data ?? [];
  const visibleIds = transactions.map(({ id }) => id);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));
  const categoryOptions = options.data?.categories ?? [];
  const tagOptions = options.data?.tags ?? [];
  const suggestionFor = (transaction: FinanceTransactionData) => {
    if (transaction.categoryName) return null;
    const merchant = normalizeMerchant(transaction.merchantName || transaction.description || '');
    return (
      rulebook.data?.rulebook?.merchantRules.find(
        (rule) => normalizeMerchant(rule.merchant) === merchant,
      )?.category ?? null
    );
  };
  const closeTransaction = useCallback(() => {
    setActiveTransaction(null);
    if (!focusedTransactionId) return;
    setDismissedTransactionId(focusedTransactionId);
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete('transactionId');
        return next;
      },
      { replace: true },
    );
  }, [focusedTransactionId, setSearchParams]);

  const batch = useMutation({
    mutationFn: async ({ ids, action }: { ids: string[]; action: BatchAction }) => {
      const response = await client.api.finance.transactions.batch.$post({ json: { ids, action } });
      if (!response.ok) throw new Error('Could not update these transactions. Try again.');
      return response.json();
    },
    onSuccess: () => {
      setSelected([]);
      setBulkDialog(null);
      void queryClient.invalidateQueries({ queryKey: ['finance'] });
    },
  });
  const linkTransfers = useMutation({
    mutationFn: async (ids: string[]) => {
      const response = await client.api.finance.transactions.transfer.pair.$post({ json: { ids } });
      if (!response.ok) throw new Error('Could not link these transactions as a transfer.');
      return response.json();
    },
    onSuccess: () => {
      setSelected([]);
      void queryClient.invalidateQueries({ queryKey: ['finance'] });
    },
  });
  const unlinkTransfer = useMutation({
    mutationFn: async (id: string) => {
      const response = await client.api.finance.transactions.transfer.unlink.$post({
        json: { id },
      });
      if (!response.ok) throw new Error('Could not unlink this transfer.');
      return response.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['finance'] }),
  });
  const saveTransaction = useMutation({
    mutationFn: async () => {
      if (!activeTransaction) return;
      const response = await client.api.finance.transactions.update.$post({
        json: {
          id: activeTransaction.id,
          data: {
            merchantName: drawerMerchant || null,
            description: drawerDescription || null,
            amount: Number(drawerAmount),
            date: drawerDate,
            notes: drawerNotes || null,
            accountId: drawerAccountId,
          },
        },
      });
      if (!response.ok) throw new Error('Could not save this transaction.');
      if (drawerCategoryId && drawerCategoryId !== activeTransaction.categoryId) {
        const categorized = await client.api.finance.transactions.batch.$post({
          json: {
            ids: [activeTransaction.id],
            action: { action: 'category', categoryId: drawerCategoryId },
          },
        });
        if (!categorized.ok)
          throw new Error('Transaction saved, but its category could not be changed.');
      }
    },
    onSuccess: () => {
      closeTransaction();
      void queryClient.invalidateQueries({ queryKey: ['finance'] });
    },
  });

  const selectAllResults = async () => {
    setSelectAllError('');
    const ids: string[] = [];
    let nextCursor: string | undefined;
    try {
      do {
        const response = await client.api.finance.transactions.list.$get({
          query: {
            limit: '50',
            ...(nextCursor ? { cursor: nextCursor } : {}),
            ...(search.trim() ? { search: search.trim() } : {}),
            ...(accountId ? { account: accountId } : {}),
            ...(categoryName ? { categoryName } : {}),
            ...(tagId ? { tagIds: tagId } : {}),
            ...(transactionType ? { transactionType } : {}),
            ...(dateFrom ? { dateFrom } : {}),
            ...(dateTo ? { dateTo } : {}),
            ...(amountMin ? { min: amountMin } : {}),
            ...(amountMax ? { max: amountMax } : {}),
            ...(status === 'uncategorized' ? { uncategorizedOnly: 'true' as const } : {}),
            ...(status === 'excluded' ? { excluded: 'true' as const } : {}),
            ...(status === 'queued' && queuedIds.length ? { transactionIds: queuedIds } : {}),
          },
        });
        if (!response.ok) throw new Error('Could not select all matching transactions.');
        const page = await response.json();
        ids.push(...page.data.map(({ id }) => id));
        if (ids.length > 5000) throw new Error('Select fewer than 5,000 transactions at once.');
        nextCursor = page.nextCursor ?? undefined;
      } while (nextCursor);
      setSelected(ids);
    } catch (error) {
      setSelectAllError(error instanceof Error ? error.message : 'Could not select all results.');
    }
  };

  const openTransaction = useCallback((transaction: FinanceTransactionData) => {
    setActiveTransaction(transaction);
    setDrawerCategoryId(transaction.categoryId ?? '');
    setDrawerMerchant(transaction.merchantName ?? '');
    setDrawerDescription(transaction.description ?? '');
    setDrawerAmount(String(transaction.amount));
    setDrawerDate(transaction.postedOn.slice(0, 10));
    setDrawerNotes(transaction.notes ?? '');
    setDrawerAccountId(transaction.accountId);
  }, []);
  useEffect(() => {
    setCursor('');
    setSelected([]);
  }, [filterKey]);

  useEffect(() => {
    if (!focusedTransactionId) setDismissedTransactionId('');
  }, [focusedTransactionId]);

  useEffect(() => {
    if (!focusedTransactionId || dismissedTransactionId === focusedTransactionId) return;
    const transaction = transactions.find(({ id }) => id === focusedTransactionId);
    if (transaction && activeTransaction?.id !== transaction.id) openTransaction(transaction);
  }, [
    activeTransaction?.id,
    dismissedTransactionId,
    focusedTransactionId,
    openTransaction,
    transactions,
  ]);

  const openBulkDialog = (action: 'merchant' | 'notes' | 'tags' | 'move') => {
    setBulkValue('');
    if (action === 'tags') setTagChoice('');
    setBulkDialog(action);
  };

  return (
    <motion.main
      animate={{ opacity: 1, transform: 'translateY(0px)' }}
      className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8"
      data-slot="finance-transactions-page"
      initial={{
        opacity: 0,
        transform: reduceMotion ? 'none' : 'translateY(12px)',
      }}
      transition={{
        duration: reduceMotion ? 0.08 : 0.24,
        ease: [0.23, 1, 0.32, 1],
      }}
    >
      <PageHeader title="Transactions" />
      <p className="mt-2 text-sm text-muted-foreground">
        Press <kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-xs">⌘K</kbd>{' '}
        to search or filter.
      </p>

      <AnimatePresence initial={false}>
        {selected.length > 0 && (
          <motion.section
            aria-label="Selected transactions"
            animate={{ opacity: 1, transform: 'translateY(0px)' }}
            className="sticky top-0 z-10 mt-4 flex min-h-14 flex-wrap items-center gap-2 rounded-lg border border-border/70 bg-background/95 px-3 py-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/85"
            data-slot="finance-selection-toolbar"
            exit={{
              opacity: 0,
              transform: reduceMotion ? 'none' : 'translateY(-6px)',
            }}
            initial={{
              opacity: 0,
              transform: reduceMotion ? 'none' : 'translateY(-6px)',
            }}
            key="selection-toolbar"
            transition={{
              duration: reduceMotion ? 0.08 : 0.16,
              ease: [0.23, 1, 0.32, 1],
            }}
          >
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                animate={{ opacity: 1, transform: 'translateY(0px)' }}
                className="shrink-0 text-sm font-medium tabular-nums"
                data-slot="finance-selection-count"
                exit={{
                  opacity: 0,
                  transform: reduceMotion ? 'none' : 'translateY(-4px)',
                }}
                initial={{
                  opacity: 0,
                  transform: reduceMotion ? 'none' : 'translateY(4px)',
                }}
                key={selected.length}
                transition={{
                  duration: reduceMotion ? 0.08 : 0.14,
                  ease: [0.23, 1, 0.32, 1],
                }}
              >
                {selected.length} selected
              </motion.span>
            </AnimatePresence>
            {transactions.length > 0 &&
              selected.length < (transactionQuery.data?.filteredCount ?? 0) && (
                <Button variant="link" size="sm" className="px-1" onClick={selectAllResults}>
                  Select all {transactionQuery.data?.filteredCount ?? selected.length}
                </Button>
              )}
            <div className="ml-auto flex min-w-0 items-center gap-2 max-sm:ml-0 max-sm:w-full max-sm:justify-between">
              <SelectField
                label="Category"
                name="bulk-category"
                labelHidden
                value={categoryChoice}
                onChange={setCategoryChoice}
                placeholder="Set category"
                className="w-36 sm:w-48"
                options={categoryOptions.map(({ id, name }) => ({ value: id, label: name }))}
              />
              <Button
                size="sm"
                disabled={!categoryChoice || batch.isPending}
                onClick={() =>
                  batch.mutate({
                    ids: selected,
                    action: {
                      action: 'category',
                      categoryId: categoryChoice,
                      ...(tagChoice ? { tagIds: [tagChoice] } : {}),
                    },
                  })
                }
              >
                Apply
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon-sm" aria-label="More actions">
                    <Ellipsis aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Selected transactions</DropdownMenuLabel>
                  <DropdownMenuItem onSelect={() => openBulkDialog('tags')}>
                    Edit tags…
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => openBulkDialog('merchant')}>
                    Change merchant…
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => openBulkDialog('notes')}>
                    Edit notes…
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => openBulkDialog('move')}>
                    Move to account…
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => batch.mutate({ ids: selected, action: { action: 'exclude' } })}
                  >
                    Exclude
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => batch.mutate({ ids: selected, action: { action: 'restore' } })}
                  >
                    Restore
                  </DropdownMenuItem>
                  {selected.length === 2 && (
                    <DropdownMenuItem onSelect={() => linkTransfers.mutate(selected)}>
                      <ArrowLeftRight aria-hidden /> Link transfer
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() =>
                      window.confirm(
                        `Delete ${selected.length} transactions? This cannot be undone.`,
                      ) && batch.mutate({ ids: selected, action: { action: 'delete' } })
                    }
                  >
                    Delete transactions…
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Clear selection"
              onClick={() => setSelected([])}
            >
              <X aria-hidden />
            </Button>
          </motion.section>
        )}
      </AnimatePresence>

      {options.error || queue.error || rulebook.error ? (
        <p role="status" className="mt-3 text-sm text-muted-foreground">
          Some category or queue details are temporarily unavailable.
        </p>
      ) : null}

      {transactions.length > 0 && (
        <div className="mt-3">
          <FinanceTransactionHeader
            checked={allVisibleSelected}
            onSelect={() =>
              setSelected((current) =>
                allVisibleSelected
                  ? current.filter((id) => !visibleIds.includes(id))
                  : [...new Set([...current, ...visibleIds])],
              )
            }
          />
        </div>
      )}
      <section role="list" aria-label="Transactions" className="mt-1 border-y border-border">
        {transactionQuery.isLoading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Loading transactions…</p>
        ) : null}
        {transactionQuery.error ? (
          <p role="alert" className="py-8 text-center text-sm text-destructive">
            {transactionQuery.error.message}
          </p>
        ) : null}
        {!transactionQuery.isLoading && !transactionQuery.error && transactions.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No transactions match these filters.
          </p>
        ) : null}
        {transactions.map((transaction, index) => (
          <FinanceTransaction
            key={transaction.id}
            transaction={transaction}
            entranceIndex={index < 5 ? index : undefined}
            selected={selected.includes(transaction.id)}
            suggestion={suggestionFor(transaction)}
            queued={queuedById.get(transaction.id) === 'queued'}
            onSelect={() =>
              setSelected((current) =>
                current.includes(transaction.id)
                  ? current.filter((id) => id !== transaction.id)
                  : [...current, transaction.id],
              )
            }
            onOpen={() => openTransaction(transaction)}
          />
        ))}
      </section>
      <div className="flex items-center justify-between py-3 text-sm text-muted-foreground">
        <span>{transactionQuery.data?.filteredCount ?? 0} transactions</span>
        <Button
          variant="outline"
          size="sm"
          disabled={!transactionQuery.data?.nextCursor || transactionQuery.isFetching}
          onClick={() => setCursor(transactionQuery.data?.nextCursor ?? '')}
        >
          Load more
        </Button>
      </div>
      {selectAllError ? (
        <p role="alert" className="text-sm text-destructive">
          {selectAllError}
        </p>
      ) : null}
      {batch.error ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {batch.error.message}
        </p>
      ) : null}
      {linkTransfers.error ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {linkTransfers.error.message}
        </p>
      ) : null}

      <Dialog
        open={Boolean(activeTransaction)}
        onOpenChange={(open) => !open && closeTransaction()}
      >
        <DialogContent
          aria-label="Transaction details"
          className="flex max-h-[85dvh] w-full max-w-2xl flex-col overflow-y-auto rounded-2xl border border-border/70 bg-popover/75 p-6 shadow-2xl backdrop-blur-2xl sm:max-w-2xl"
        >
          {activeTransaction && (
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput
                label="Merchant"
                name="merchant"
                value={drawerMerchant}
                onChange={(event) => setDrawerMerchant(event.target.value)}
              />
              <TextInput
                label="Description"
                name="description"
                value={drawerDescription}
                onChange={(event) => setDrawerDescription(event.target.value)}
              />
              <CurrencyField
                label="Amount"
                name="amount"
                currency={activeTransaction.currencyCode}
                step="0.01"
                value={drawerAmount}
                onChange={(event) => setDrawerAmount(event.target.value)}
              />
              <TextInput
                label="Date"
                name="posted-on"
                type="date"
                value={drawerDate}
                onChange={(event) => setDrawerDate(event.target.value)}
              />
              <SelectField
                label="Account"
                name="drawer-account"
                value={drawerAccountId}
                onChange={setDrawerAccountId}
                options={accounts.map((account) => ({ value: account.id, label: account.name }))}
              />
              <SelectField
                label="Category"
                name="drawer-category"
                value={drawerCategoryId}
                onChange={setDrawerCategoryId}
                placeholder="Uncategorized"
                options={categoryOptions.map(({ id, name }) => ({ value: id, label: name }))}
              />
              <TextAreaInput
                label="Notes"
                name="notes"
                rows={3}
                value={drawerNotes}
                onChange={(event) => setDrawerNotes(event.target.value)}
                className="sm:col-span-2"
              />
              {activeTransaction.counterpartId && (
                <div className="flex items-center gap-2 sm:col-span-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => unlinkTransfer.mutate(activeTransaction.id)}
                  >
                    Unlink transfer
                  </Button>
                </div>
              )}
            </div>
          )}
          {saveTransaction.error ? (
            <p role="alert" className="text-sm text-destructive">
              {saveTransaction.error.message}
            </p>
          ) : null}
          <DialogFooter className="mt-auto">
            <Button variant="outline" onClick={closeTransaction}>
              Cancel
            </Button>
            <Button disabled={saveTransaction.isPending} onClick={() => saveTransaction.mutate()}>
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={bulkDialog !== null} onOpenChange={(open) => !open && setBulkDialog(null)}>
        <DialogContent className="rounded-sm">
          <DialogHeader>
            <DialogTitle>
              {bulkDialog === 'merchant'
                ? 'Change merchant'
                : bulkDialog === 'notes'
                  ? 'Edit notes'
                  : bulkDialog === 'tags'
                    ? 'Edit tags'
                    : 'Move to account'}
            </DialogTitle>
          </DialogHeader>
          {bulkDialog === 'tags' ? (
            <SelectField
              label="Tag"
              name="bulk-tags"
              value={tagChoice}
              onChange={setTagChoice}
              placeholder="Choose a tag"
              options={tagOptions.map(({ id, name }) => ({ value: id, label: name }))}
            />
          ) : bulkDialog === 'move' ? (
            <SelectField
              label="Account"
              name="bulk-account"
              value={bulkValue}
              onChange={setBulkValue}
              placeholder="Choose an account"
              options={accounts.map(({ id, name }) => ({ value: id, label: name }))}
            />
          ) : bulkDialog === 'notes' ? (
            <TextAreaInput
              label="Notes"
              name="bulk-notes"
              rows={3}
              value={bulkValue}
              onChange={(event) => setBulkValue(event.target.value)}
            />
          ) : (
            <TextInput
              label="Merchant name"
              name="bulk-merchant"
              value={bulkValue}
              onChange={(event) => setBulkValue(event.target.value)}
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialog(null)}>
              Cancel
            </Button>
            <Button
              disabled={
                (bulkDialog === 'tags' && !tagChoice) || (bulkDialog === 'move' && !bulkValue)
              }
              onClick={() => {
                if (bulkDialog === 'tags')
                  batch.mutate({ ids: selected, action: { action: 'tags', tagIds: [tagChoice] } });
                else if (bulkDialog === 'move')
                  batch.mutate({ ids: selected, action: { action: 'move', accountId: bulkValue } });
                else if (bulkDialog)
                  batch.mutate({
                    ids: selected,
                    action: { action: bulkDialog, value: bulkValue || null },
                  });
              }}
            >
              Apply to {selected.length}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.main>
  );
}
