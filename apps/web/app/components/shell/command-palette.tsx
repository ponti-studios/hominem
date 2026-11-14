import type {
  AccountListOutput,
  TransactionListOutput,
  TransactionOptionsOutput,
} from '@hominem/rpc/finance';
import { ArrowUpRight, Check, CornerDownLeft, Filter, Search, Wallet, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';

import { SelectField } from '~/components/design';
import { Button } from '~/components/ui/button';
import { buildPaletteIndex, searchPalette, type PaletteItem } from '~/lib/navigation';
import { cn } from '~/lib/utils';
import { useFinanceQuery } from '~/modules/finance/lib/api';
import { formatCurrency } from '~/modules/finance/lib/number.utils';

type FinanceResult = {
  key: string;
  label: string;
  detail: string;
  path: string;
  kind: 'account' | 'transaction' | 'transactionSearch';
};
type PaletteResult = PaletteItem | FinanceResult;

const KIND_LABEL: Record<string, string> = {
  account: 'Accounts',
  transaction: 'Transactions',
  transactionSearch: 'Ledger',
  domain: 'Domains',
  page: 'Pages',
  action: 'Actions',
};

function normalize(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .trim();
}

function editDistance(left: string, right: string) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    let diagonal = previous[0] ?? 0;
    previous[0] = row;
    for (let column = 1; column <= right.length; column += 1) {
      const above = previous[column] ?? 0;
      previous[column] = Math.min(
        above + 1,
        (previous[column - 1] ?? 0) + 1,
        diagonal + (left[row - 1] === right[column - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }
  return previous[right.length] ?? Number.POSITIVE_INFINITY;
}

function fuzzyIncludes(text: string, query: string) {
  if (text.includes(query)) return true;
  if (query.length < 4) return false;
  const threshold = query.length >= 8 ? 2 : 1;
  return text.split(/\s+/).some((token) => editDistance(token, query) <= threshold);
}

function parseAmountSearch(query: string) {
  const match = query.match(
    /^\$?([\d,]+(?:\.\d{1,2})?)(?:\s*(?:-|to)\s*\$?([\d,]+(?:\.\d{1,2})?))?$/i,
  );
  if (!match) return null;
  const first = Number(match[1]?.replaceAll(',', ''));
  const second = match[2] ? Number(match[2].replaceAll(',', '')) : first;
  return Number.isFinite(first) && Number.isFinite(second)
    ? { min: Math.min(first, second), max: Math.max(first, second) }
    : null;
}

function isPaletteItem(result: PaletteResult): result is PaletteItem {
  return result.kind === 'domain' || result.kind === 'page' || result.kind === 'action';
}

function isFinanceTransactions(pathname: string) {
  return pathname === '/finance/transactions';
}

function getListClassName(filtersOpen: boolean, query: string) {
  const base = 'min-h-0 overflow-y-auto border-t border-border p-2';
  if (!filtersOpen) return cn(base, 'max-h-[46vh] flex-1');
  return query.trim() ? cn(base, 'max-h-[34vh] flex-1') : cn(base, 'max-h-24 flex-none');
}

function getEmptyMessage(filtersOpen: boolean, query: string) {
  if (filtersOpen) return 'Adjust filters or search transactions.';
  if (query.trim().length < 2) return 'Search transactions, accounts, or anything to jump to.';
  return `No matches for “${query}”.`;
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [active, setActive] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const index = useMemo(() => buildPaletteIndex(), []);
  const financeQuery = normalize(query);
  const financeSearch = normalize(debouncedQuery);
  const amountSearch = parseAmountSearch(financeSearch);
  const readyToSearch = financeQuery.length >= 2;
  const transactionsPath = isFinanceTransactions(location.pathname);

  const accountsQuery = useFinanceQuery<AccountListOutput>(
    ['finance', 'accounts', 'list'],
    ({ finance }) =>
      finance.accounts.list
        .$get({ query: { includeInactive: 'false' } })
        .then((response) => response.json()),
    { enabled: open, staleTime: 60_000 },
  );
  const transactionsQuery = useFinanceQuery<TransactionListOutput>(
    ['finance', 'transactions', 'palette-search', financeSearch],
    ({ finance }) =>
      finance.transactions.list
        .$get({
          query: {
            ...(amountSearch
              ? { min: String(amountSearch.min), max: String(amountSearch.max) }
              : { search: financeSearch }),
            limit: '8',
          },
        })
        .then((response) => response.json()),
    { enabled: open && financeSearch.length >= 2, staleTime: 30_000 },
  );
  const optionsQuery = useFinanceQuery<TransactionOptionsOutput>(
    ['finance', 'transactions', 'options'],
    ({ finance }) => finance.transactions.options.$get().then((response) => response.json()),
    { enabled: open && transactionsPath, staleTime: 60_000 },
  );

  const accounts = useMemo(() => {
    if (!readyToSearch || amountSearch) return [];
    return (accountsQuery.data?.accounts ?? []).filter((account) =>
      fuzzyIncludes(normalize(`${account.name} ${account.accountType}`), financeQuery),
    );
  }, [accountsQuery.data?.accounts, amountSearch, financeQuery, readyToSearch]);
  const transactions =
    readyToSearch && financeSearch === financeQuery ? (transactionsQuery.data?.data ?? []) : [];
  const transactionParams = new URLSearchParams();
  if (amountSearch) {
    transactionParams.set('min', String(amountSearch.min));
    transactionParams.set('max', String(amountSearch.max));
  } else if (financeSearch) {
    transactionParams.set('search', financeSearch);
  }
  const navigation =
    filtersOpen && transactionsPath && !query.trim() ? [] : searchPalette(index, query);
  const ledgerParams = new URLSearchParams(searchParams);
  ledgerParams.delete('transactionId');
  if (amountSearch) {
    ledgerParams.delete('search');
    ledgerParams.set('min', String(amountSearch.min));
    ledgerParams.set('max', String(amountSearch.max));
  } else {
    ledgerParams.set('search', query.trim());
    ledgerParams.delete('min');
    ledgerParams.delete('max');
  }
  const ledgerSearch: FinanceResult[] =
    readyToSearch && transactionsPath
      ? [
          {
            key: 'transaction-search',
            label: `Search all transactions for “${query.trim()}”`,
            detail: 'Show every matching transaction in the ledger',
            path: `/finance/transactions?${ledgerParams.toString()}`,
            kind: 'transactionSearch',
          },
        ]
      : [];
  const results: PaletteResult[] = [
    ...ledgerSearch,
    ...accounts.map((account) => ({
      key: `account:${account.id}`,
      label: account.name,
      detail: `${account.accountType} · ${account.currencyCode}`,
      path: `/finance/accounts/${account.id}`,
      kind: 'account' as const,
    })),
    ...transactions.map((transaction) => {
      const params = new URLSearchParams(transactionParams);
      params.set('transactionId', transaction.id);
      return {
        key: `transaction:${transaction.id}`,
        label: transaction.merchantName || transaction.description || 'Transaction',
        detail: `${transaction.postedOn.slice(0, 10)} · ${transaction.accountName} · ${formatCurrency(transaction.amount, transaction.currencyCode ?? 'USD')}`,
        path: `/finance/transactions?${params.toString()}`,
        kind: 'transaction' as const,
      };
    }),
    ...navigation,
  ];
  const activeFilters = [...searchParams.entries()].filter(
    ([key, value]) =>
      [
        'search',
        'account',
        'category',
        'tag',
        'type',
        'from',
        'to',
        'status',
        'min',
        'max',
      ].includes(key) && value,
  );
  const activeFilterCount = activeFilters.filter(([key]) => key !== 'max').length;

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setDebouncedQuery('');
    setActive(0);
    setFiltersOpen(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 120);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => setActive(0), [query]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose, open]);

  useEffect(() => {
    setActive((current) => Math.min(current, Math.max(results.length - 1, 0)));
  }, [results.length]);

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  function go(path: string) {
    onClose();
    void navigate(path, { viewTransition: true });
  }

  function updateFilter(key: string, value: string) {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set(key, value);
        else next.delete(key);
        next.delete('transactionId');
        return next;
      },
      { replace: true },
    );
  }

  function clearFilters() {
    setSearchParams(new URLSearchParams(), { replace: true });
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (results.length) setActive((current) => Math.min(current + 1, results.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (results.length) setActive((current) => Math.max(current - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const result = results[active];
      if (result) go(result.path);
      else if (query.trim()) go(`/finance/transactions?search=${encodeURIComponent(query.trim())}`);
    }
  }

  function onDialogKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    if (filtersOpen) setFiltersOpen(false);
    else onClose();
  }

  let lastKind = '';

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[80] flex items-start justify-center px-4 pt-4 sm:pt-[10vh]"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
        >
          <div
            aria-hidden
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-background shadow-2xl sm:max-h-[90dvh]"
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            role="dialog"
            aria-modal="true"
            aria-label="Search and commands"
            onKeyDown={onDialogKeyDown}
            transition={{ type: 'spring', stiffness: 480, damping: 36 }}
          >
            <div className="flex items-center gap-3 px-4">
              <Search aria-hidden className="size-5 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                aria-label="Search transactions, accounts, pages, and actions"
                autoComplete="off"
                className="h-16 min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search transactions, accounts, pages…"
                role="combobox"
                aria-expanded="true"
                aria-controls="palette-list"
                aria-activedescendant={results.length ? `palette-item-${active}` : undefined}
                spellCheck={false}
                value={query}
              />
              {transactionsPath ? (
                <Button
                  aria-expanded={filtersOpen}
                  aria-label={
                    filtersOpen
                      ? 'Hide transaction filters'
                      : `Filter transactions${activeFilterCount ? `, ${activeFilterCount} active` : ''}`
                  }
                  onClick={() => setFiltersOpen((current) => !current)}
                  size="icon-sm"
                  variant={filtersOpen ? 'secondary' : 'ghost'}
                >
                  <Filter aria-hidden className="size-4" />
                  {activeFilterCount ? (
                    <span className="text-xs tabular-nums" aria-hidden>
                      {activeFilterCount}
                    </span>
                  ) : null}
                </Button>
              ) : null}
              <kbd className="rounded border border-border px-2 py-1 text-xs text-muted-foreground">
                ESC
              </kbd>
            </div>

            <AnimatePresence initial={false}>
              {filtersOpen && transactionsPath ? (
                <motion.section
                  animate={{ opacity: 1, height: 'auto' }}
                  aria-label="Transaction filters"
                  className="max-h-[55vh] overflow-y-auto border-t border-border px-4 py-4"
                  exit={{ opacity: 0, height: 0 }}
                  initial={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.18 }}
                >
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <SelectField
                      label="Account"
                      name="palette-account"
                      value={searchParams.get('account') ?? ''}
                      onChange={(value) => updateFilter('account', value)}
                      placeholder="All accounts"
                      options={(accountsQuery.data?.accounts ?? []).map(({ id, name }) => ({
                        value: id,
                        label: name,
                      }))}
                    />
                    <SelectField
                      label="Category"
                      name="palette-category"
                      value={searchParams.get('category') ?? ''}
                      onChange={(value) => updateFilter('category', value)}
                      placeholder="All categories"
                      options={(optionsQuery.data?.categories ?? []).map(({ name }) => ({
                        value: name,
                        label: name,
                      }))}
                    />
                    <SelectField
                      label="Tag"
                      name="palette-tag"
                      value={searchParams.get('tag') ?? ''}
                      onChange={(value) => updateFilter('tag', value)}
                      placeholder="All tags"
                      options={(optionsQuery.data?.tags ?? []).map(({ id, name }) => ({
                        value: id,
                        label: name,
                      }))}
                    />
                    <SelectField
                      label="Type"
                      name="palette-type"
                      value={searchParams.get('type') ?? ''}
                      onChange={(value) => updateFilter('type', value)}
                      placeholder="All types"
                      options={[
                        { value: 'income', label: 'Income' },
                        { value: 'expense', label: 'Expense' },
                        { value: 'transfer', label: 'Transfer' },
                      ]}
                    />
                    <SelectField
                      label="Status"
                      name="palette-status"
                      value={searchParams.get('status') ?? 'all'}
                      onChange={(value) => updateFilter('status', value === 'all' ? '' : value)}
                      placeholder="All transactions"
                      options={[
                        { value: 'all', label: 'All transactions' },
                        { value: 'uncategorized', label: 'Uncategorized' },
                        { value: 'excluded', label: 'Excluded' },
                        { value: 'queued', label: 'Queued' },
                      ]}
                    />
                    <fieldset className="col-span-2 grid min-w-0 grid-cols-2 gap-3 sm:col-span-3">
                      <legend className="col-span-2 text-sm font-medium text-foreground">
                        Date range
                      </legend>
                      <label className="grid min-w-0 gap-1.5 text-sm font-medium text-foreground">
                        From
                        <input
                          aria-label="From date"
                          className="h-10 min-w-0 rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:border-sky-400 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-sky-400"
                          onChange={(event) => updateFilter('from', event.target.value)}
                          type="date"
                          value={searchParams.get('from') ?? ''}
                        />
                      </label>
                      <label className="grid min-w-0 gap-1.5 text-sm font-medium text-foreground">
                        To
                        <input
                          aria-label="To date"
                          className="h-10 min-w-0 rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:border-sky-400 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-sky-400"
                          onChange={(event) => updateFilter('to', event.target.value)}
                          type="date"
                          value={searchParams.get('to') ?? ''}
                        />
                      </label>
                    </fieldset>
                  </div>
                  {activeFilterCount ? (
                    <Button className="mt-3" onClick={clearFilters} size="sm" variant="ghost">
                      <X aria-hidden className="size-3.5" />
                      Clear filters
                    </Button>
                  ) : null}
                </motion.section>
              ) : null}
            </AnimatePresence>

            <div
              ref={listRef}
              id="palette-list"
              role="listbox"
              className={getListClassName(filtersOpen, query)}
            >
              {readyToSearch &&
              (financeSearch !== financeQuery ||
                accountsQuery.isLoading ||
                transactionsQuery.isLoading) ? (
                <p role="status" className="px-3 py-2 text-sm text-muted-foreground">
                  Searching Finance…
                </p>
              ) : null}
              {accountsQuery.error || transactionsQuery.error ? (
                <p role="status" className="px-3 py-2 text-sm text-muted-foreground">
                  Some Finance results are unavailable right now.
                </p>
              ) : null}
              {results.length === 0 && (query.trim().length < 2 || !transactionsQuery.isLoading) ? (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                  {getEmptyMessage(filtersOpen, query)}
                </p>
              ) : null}
              {results.map((result, position) => {
                const header =
                  result.kind !== lastKind ? (
                    <p
                      key={`header-${result.kind}`}
                      className="px-3 pt-3 pb-1 font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase"
                    >
                      {KIND_LABEL[result.kind]}
                    </p>
                  ) : null;
                lastKind = result.kind;
                const financeResult = !isPaletteItem(result);
                return (
                  <div key={result.key}>
                    {header}
                    <button
                      aria-selected={position === active}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors',
                        position === active ? 'bg-muted' : 'bg-transparent',
                      )}
                      data-index={position}
                      id={`palette-item-${position}`}
                      onClick={() => go(result.path)}
                      onMouseMove={() => setActive(position)}
                      role="option"
                      type="button"
                    >
                      <span
                        aria-hidden
                        className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
                      >
                        {result.kind === 'account' ? <Wallet className="size-4" /> : null}
                        {result.kind === 'transaction' ? <Check className="size-4" /> : null}
                        {result.kind === 'transactionSearch' ? <Search className="size-4" /> : null}
                        {isPaletteItem(result) ? (
                          <span className="size-1.5 rounded-full bg-primary" />
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {result.label}
                        </span>
                        {financeResult ? (
                          <span className="block truncate text-xs text-muted-foreground">
                            {result.detail}
                          </span>
                        ) : null}
                      </span>
                      {position === active ? (
                        <CornerDownLeft aria-hidden className="size-4 shrink-0 text-foreground" />
                      ) : (
                        <ArrowUpRight
                          aria-hidden
                          className="size-4 shrink-0 text-muted-foreground"
                        />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-4 py-2.5 font-mono text-[10px] tracking-wider text-muted-foreground uppercase sm:px-5">
              <span>↑↓ navigate</span>
              <span>↵ open</span>
              {transactionsPath ? <span>Filters apply to the ledger</span> : null}
              <span className="ml-auto">esc close</span>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
