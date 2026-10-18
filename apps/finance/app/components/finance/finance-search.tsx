import type { AccountListOutput, TransactionListOutput } from '@hominem/rpc/finance';
import { Dialog, DialogContent, DialogTitle } from '@ponti-studios/ui/overlays';
import { Button } from '@ponti-studios/ui/primitives';
import { ArrowUpRight, Search, Wallet } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import { useHonoQuery } from '~/lib/api/client';
import { formatCurrency } from '~/lib/number.utils';

const RESULT_LIMIT = 8;
const MIN_QUERY_LENGTH = 2;

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

function accountMatches(account: AccountListOutput['accounts'][number], query: string) {
  const text = normalize(`${account.name} ${account.accountType}`);
  return fuzzyIncludes(text, normalize(query));
}

function formatAccountType(type: string) {
  return type.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

type FinanceSearchProps = { className?: string };

export function FinanceSearch({ className }: FinanceSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const normalizedQuery = query.trim();
  const normalizedSearch = debouncedQuery.trim();
  const readyToSearch = normalizedQuery.length >= MIN_QUERY_LENGTH;
  const amountSearch = parseAmountSearch(normalizedSearch);

  const accountsQuery = useHonoQuery<AccountListOutput>(
    ['finance', 'accounts', 'list'],
    ({ finance }) =>
      finance.accounts.list.$get({ query: { includeInactive: 'false' } }).then((r) => r.json()),
    { enabled: open, staleTime: 60_000 },
  );
  const transactionsQuery = useHonoQuery<TransactionListOutput>(
    ['finance', 'transactions', 'search', normalizedSearch],
    ({ finance }) =>
      finance.transactions.list
        .$get({
          query: {
            ...(amountSearch
              ? { min: String(amountSearch.min), max: String(amountSearch.max) }
              : { description: normalizedSearch }),
            limit: String(RESULT_LIMIT),
            offset: '0',
          },
        })
        .then((r) => r.json()),
    { enabled: open && normalizedSearch.length >= MIN_QUERY_LENGTH, staleTime: 30_000 },
  );

  const accounts = useMemo(
    () =>
      amountSearch
        ? []
        : (accountsQuery.data?.accounts ?? []).filter((account) =>
            accountMatches(account, normalizedQuery),
          ),
    [accountsQuery.data?.accounts, amountSearch, normalizedQuery],
  );
  const transactions =
    normalizedSearch === normalizedQuery ? (transactionsQuery.data?.data ?? []) : [];
  const resultsCount = accounts.length + transactions.length;

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(normalizedQuery), 100);
    return () => window.clearTimeout(timer);
  }, [normalizedQuery]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => setActiveIndex(0), [normalizedQuery]);

  const close = () => {
    setOpen(false);
    setQuery('');
    setDebouncedQuery('');
  };

  const openResult = (index: number) => {
    if (index < accounts.length) {
      const account = accounts[index];
      if (account) navigate(`/accounts/${account.id}`);
    } else {
      const transaction = transactions[index - accounts.length];
      if (transaction) {
        const searchTerm = transaction.description ?? transaction.merchantName ?? '';
        navigate(`/finance?search=${encodeURIComponent(searchTerm)}`);
      }
    }
    close();
  };

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => (resultsCount ? (index + 1) % resultsCount : 0));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => (resultsCount ? (index - 1 + resultsCount) % resultsCount : 0));
    } else if (event.key === 'Enter' && resultsCount > 0) {
      event.preventDefault();
      openResult(activeIndex);
    }
  };

  const loading =
    accountsQuery.isLoading ||
    (readyToSearch && (normalizedSearch !== normalizedQuery || transactionsQuery.isLoading));

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={className}
        aria-label="Search transactions and accounts"
        onClick={() => setOpen(true)}
      >
        <Search className="size-4" aria-hidden="true" />
        <span className="sr-only">Search transactions and accounts</span>
      </Button>
      <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
        <DialogContent className="top-[18vh] max-w-2xl translate-y-0 gap-0 overflow-hidden rounded-xl border-border bg-popover p-0 shadow-2xl">
          <DialogTitle className="sr-only">Search finance</DialogTitle>
          <div className="flex items-center gap-3 border-b border-border px-5">
            <Search className="size-5 shrink-0 text-primary" aria-hidden="true" />
            <label htmlFor="finance-global-search" className="sr-only">
              Search transactions and accounts
            </label>
            <input
              id="finance-global-search"
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onInputKeyDown}
              className="h-[68px] min-w-0 flex-1 bg-transparent text-lg text-foreground outline-none placeholder:text-muted-foreground"
              placeholder="Search transactions and accounts…"
              autoComplete="off"
              aria-controls="finance-search-results"
              aria-activedescendant={resultsCount ? `finance-result-${activeIndex}` : undefined}
            />
            <kbd className="rounded border border-border px-2 py-1 text-xs text-muted-foreground">
              ESC
            </kbd>
          </div>
          <div
            id="finance-search-results"
            className="max-h-[min(60vh,520px)] overflow-y-auto p-3"
            role="listbox"
            aria-label="Search results"
          >
            {!readyToSearch ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                Search by merchant, description, or account.
              </p>
            ) : loading ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground" role="status">
                Searching your finances…
              </p>
            ) : accountsQuery.error || transactionsQuery.error ? (
              <p className="px-3 py-8 text-center text-sm text-destructive" role="alert">
                Search is unavailable. Try again in a moment.
              </p>
            ) : resultsCount === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                No matching accounts or transactions.
              </p>
            ) : (
              <>
                {accounts.length > 0 && (
                  <section aria-label="Accounts">
                    <h3 className="px-3 pb-2 pt-1 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                      Accounts
                    </h3>
                    <ul>
                      {accounts.map((account, index) => (
                        <li key={account.id}>
                          <button
                            id={`finance-result-${index}`}
                            type="button"
                            role="option"
                            aria-selected={activeIndex === index}
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left hover:bg-muted aria-selected:bg-muted"
                            onMouseEnter={() => setActiveIndex(index)}
                            onClick={() => openResult(index)}
                          >
                            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                              <Wallet className="size-4" aria-hidden="true" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium text-foreground">
                                {account.name}
                              </span>
                              <span className="block truncate text-sm text-muted-foreground">
                                {formatAccountType(account.accountType)}
                              </span>
                            </span>
                            <span className="shrink-0 tabular-nums text-sm text-foreground">
                              {formatCurrency(account.balanceCents / 100)}
                            </span>
                            <ArrowUpRight
                              className="size-4 shrink-0 text-muted-foreground"
                              aria-hidden="true"
                            />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                {transactions.length > 0 && (
                  <section
                    aria-label="Transactions"
                    className={accounts.length ? 'mt-3 border-t border-border pt-3' : ''}
                  >
                    <h3 className="px-3 pb-2 pt-1 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                      Transactions
                    </h3>
                    <ul>
                      {transactions.map((transaction, index) => {
                        const resultIndex = accounts.length + index;
                        return (
                          <li key={transaction.id}>
                            <button
                              id={`finance-result-${resultIndex}`}
                              type="button"
                              role="option"
                              aria-selected={activeIndex === resultIndex}
                              className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left hover:bg-muted aria-selected:bg-muted"
                              onMouseEnter={() => setActiveIndex(resultIndex)}
                              onClick={() => openResult(resultIndex)}
                            >
                              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted font-semibold text-primary">
                                {(transaction.merchantName ?? transaction.description ?? '?')
                                  .slice(0, 1)
                                  .toUpperCase()}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-medium text-foreground">
                                  {transaction.merchantName ??
                                    transaction.description ??
                                    'Transaction'}
                                </span>
                                <span className="block truncate text-sm text-muted-foreground">
                                  {transaction.description} · {transaction.postedOn}
                                </span>
                              </span>
                              <span className="shrink-0 tabular-nums text-sm text-foreground">
                                {formatCurrency(transaction.amount)}
                              </span>
                              <ArrowUpRight
                                className="size-4 shrink-0 text-muted-foreground"
                                aria-hidden="true"
                              />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                )}
              </>
            )}
          </div>
          <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-muted-foreground">
            <span>
              <kbd className="mr-1 rounded border border-border px-1.5 py-0.5">↑</kbd>
              <kbd className="ml-1 mr-2 rounded border border-border px-1.5 py-0.5">
                ↓
              </kbd>Navigate{' '}
              <kbd className="ml-3 mr-1 rounded border border-border px-1.5 py-0.5">↵</kbd>Open
            </span>
            <span>{readyToSearch && !loading ? `${resultsCount} matches` : 'Search anywhere'}</span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
