import { Spinner } from '@ponti-studios/ui/feedback';
import { format, subMonths } from 'date-fns';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import { PageHeader, PanelState } from '~/components/design';
import { Chip } from '~/components/design/chip';
import { DataTable } from '~/components/design/data-table';
import { ListSkeleton } from '~/components/design/skeleton';
import { SectionCard } from '~/components/design/surfaces';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { TransactionFilters } from '~/modules/finance/components/finance/transaction-filters';
import { useTagBreakdown } from '~/modules/finance/hooks/use-analytics';
import { type FilterArgs, useFinanceAccounts } from '~/modules/finance/hooks/use-finance-data';
import { useSelectedAccount } from '~/modules/finance/hooks/use-selected-account';
import { useSort } from '~/modules/finance/hooks/use-sort';
import { formatCurrency } from '~/modules/finance/lib/number.utils';

interface TagBreakdownRow {
  tag: string;
  amount: number;
  transactionCount: number;
  percentage: number;
  currencyCode: string;
}

export default function TagsAnalyticsPage() {
  const navigate = useNavigate();
  const { selectedAccount, setSelectedAccount } = useSelectedAccount();

  const [filters, setFilters] = useState<FilterArgs>({
    dateFrom: subMonths(new Date(), 6),
    dateTo: new Date(),
  });

  const [debouncedFilters, setDebouncedFilters] = useState<FilterArgs>(filters);

  const [searchValue, setSearchValue] = useState('');
  const { sortOptions, isDefaultSort, addSortOption, updateSortOption, removeSortOption } = useSort(
    {
      initialSortOptions: [],
    },
  );

  const {
    accountsMap,
    isLoading: accountsLoading,
    refetch: refetchAccounts,
  } = useFinanceAccounts();

  // Debounce filter changes (300ms delay)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilters(filters);
    }, 300);

    return () => {
      clearTimeout(timer);
    };
  }, [filters]);

  const {
    data: breakdown,
    isLoading,
    isFetching,
    error,
    refetch: refetchBreakdown,
  } = useTagBreakdown({
    from: debouncedFilters.dateFrom,
    to: debouncedFilters.dateTo,
    account: selectedAccount !== 'all' ? selectedAccount : undefined,
    limit: 100,
  });

  const tagRows = breakdown?.breakdown ?? [];

  const filteredAndSortedData = useMemo<TagBreakdownRow[]>(() => {
    let result = [...tagRows];

    if (searchValue.trim()) {
      result = result.filter((item) => item.tag.toLowerCase().includes(searchValue.toLowerCase()));
    }

    if (sortOptions.length > 0) {
      const sort = sortOptions[0];
      if (sort) {
        result.sort((a, b) => {
          if (a.currencyCode !== b.currencyCode) {
            return a.currencyCode.localeCompare(b.currencyCode);
          }
          let aValue: string | number;
          let bValue: string | number;

          if (sort.field === 'tag') {
            aValue = a.tag.toLowerCase();
            bValue = b.tag.toLowerCase();
          } else if (sort.field === 'amount') {
            aValue = a.amount;
            bValue = b.amount;
          } else if (sort.field === 'transactionCount') {
            aValue = a.transactionCount;
            bValue = b.transactionCount;
          } else {
            return 0;
          }

          if (aValue < bValue) {
            return sort.direction === 'asc' ? -1 : 1;
          }
          if (aValue > bValue) {
            return sort.direction === 'asc' ? 1 : -1;
          }
          return 0;
        });
      }
    }

    return result;
  }, [tagRows, searchValue, sortOptions]);

  const handleFiltersChange = useCallback((newFilters: FilterArgs) => {
    setFilters(newFilters);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearchValue(value);
  }, []);

  const handleRefresh = useCallback(() => {
    refetchAccounts();
    refetchBreakdown();
  }, [refetchAccounts, refetchBreakdown]);

  const handleSortHeaderClick = useCallback(
    (field: 'tag' | 'amount' | 'transactionCount') => {
      const existingSort = sortOptions.find((s) => s.field === field);
      if (existingSort) {
        updateSortOption(0, {
          ...existingSort,
          direction: existingSort.direction === 'asc' ? 'desc' : 'asc',
        });
      } else {
        addSortOption({ field, direction: 'desc' });
      }
    },
    [sortOptions, addSortOption, updateSortOption],
  );

  const getSortDirection = (field: string) => {
    const sort = sortOptions.find((s) => s.field === field);
    return sort?.direction;
  };

  const activeFilters = useMemo(() => {
    const filterChips: Array<{ id: string; label: string; onRemove: () => void }> = [];

    if (debouncedFilters.dateFrom) {
      filterChips.push({
        id: 'dateFrom',
        label: `From: ${format(debouncedFilters.dateFrom, 'MMM d, yyyy')}`,
        onRemove: () => {
          handleFiltersChange({ ...debouncedFilters, dateFrom: undefined });
        },
      });
    }

    if (debouncedFilters.dateTo) {
      filterChips.push({
        id: 'dateTo',
        label: `To: ${format(debouncedFilters.dateTo, 'MMM d, yyyy')}`,
        onRemove: () => {
          handleFiltersChange({ ...debouncedFilters, dateTo: undefined });
        },
      });
    }

    if (selectedAccount !== 'all') {
      const accountName = accountsMap.get(selectedAccount)?.name || 'Account';
      filterChips.push({
        id: 'account',
        label: accountName,
        onRemove: () => {
          setSelectedAccount('all');
        },
      });
    }

    return filterChips;
  }, [debouncedFilters, selectedAccount, accountsMap, handleFiltersChange, setSelectedAccount]);

  const handleClearFilters = useCallback(() => {
    setFilters({
      dateFrom: subMonths(new Date(), 6),
      dateTo: new Date(),
    });
    setSelectedAccount('all');
    setSearchValue('');
  }, [setSelectedAccount]);

  const loading = isLoading || accountsLoading;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow="Finance · Analytics"
        title="Tags Breakdown"
        description="Spending by tag for the selected period."
        accent="#9d7bff"
      />

      <TransactionFilters
        accountsMap={accountsMap}
        accountsLoading={accountsLoading}
        filters={filters}
        onFiltersChange={handleFiltersChange}
        searchValue={searchValue}
        onSearchChange={handleSearchChange}
        sortOptions={sortOptions}
        isDefaultSort={isDefaultSort}
        addSortOption={addSortOption}
        updateSortOption={updateSortOption}
        removeSortOption={removeSortOption}
        onRefresh={handleRefresh}
        loading={loading}
      />

      {(activeFilters.length > 0 || searchValue.trim()) && (
        <div className="flex flex-wrap items-center gap-2">
          {activeFilters.map((filter) => (
            <Chip key={filter.id} onRemove={filter.onRemove} removeLabel={`Remove ${filter.label}`}>
              {filter.label}
            </Chip>
          ))}
          {searchValue.trim() && (
            <Chip onRemove={() => setSearchValue('')} removeLabel="Clear search">
              Search: {searchValue}
            </Chip>
          )}
          {(activeFilters.length > 0 || searchValue.trim()) && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="inline-flex h-7 items-center rounded-full px-3 text-[13px] font-medium text-[#9ba3b4] transition-colors hover:text-[#f2f4f8]"
            >
              Clear all
            </button>
          )}
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <SectionCard>
          <ListSkeleton rows={5} label="Loading tags" />
        </SectionCard>
      ) : error ? (
        /* Error State */
        <PanelState
          title="Tags unavailable"
          description={
            typeof error === 'string'
              ? error
              : error instanceof Error
                ? error.message
                : 'An unknown error occurred'
          }
          action={
            <Button onClick={() => refetchBreakdown()} variant="outline">
              Retry
            </Button>
          }
        />
      ) : filteredAndSortedData.length === 0 ? (
        /* Empty State */
        <PanelState
          title={
            searchValue.trim() || activeFilters.length > 0
              ? 'No tags found matching your filters'
              : 'No tag data available for the selected period'
          }
        />
      ) : (
        /* Table with Data */
        <SectionCard>
          <div className="relative p-2 sm:p-4">
            {isFetching && !isLoading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40">
                <Spinner size="md" />
              </div>
            )}
            <DataTable
              ariaLabel="Tags breakdown"
              rows={filteredAndSortedData}
              keyOf={(item) => `${item.currencyCode}-${item.tag}`}
              onRowClick={(item) =>
                navigate(`/finance/analytics/tag/${encodeURIComponent(item.tag)}`)
              }
              rowLabel={(item) => `View details for ${item.tag}`}
              columns={[
                {
                  key: 'tag',
                  header: 'Tag',
                  sort: {
                    direction: getSortDirection('tag') ?? null,
                    onSort: () => handleSortHeaderClick('tag'),
                    label: 'Sort by tag',
                  },
                  render: (item) => (
                    <span className="inline-flex items-center gap-2">
                      <Badge variant="secondary">{item.transactionCount}x</Badge>
                      <span className="font-medium">{item.tag}</span>
                    </span>
                  ),
                },
                {
                  key: 'total',
                  header: 'Total',
                  align: 'right',
                  sort: {
                    direction: getSortDirection('amount') ?? null,
                    onSort: () => handleSortHeaderClick('amount'),
                    label: 'Sort by total',
                  },
                  render: (item) => (
                    <span className="inline-flex flex-col items-end gap-1">
                      <span className="font-mono font-semibold">
                        {formatCurrency(item.amount, item.currencyCode)}
                      </span>
                      <span className="text-xs text-[#9ba3b4]">{item.percentage.toFixed(1)}%</span>
                      <span
                        className="block h-1 w-24 overflow-hidden rounded-full bg-white/[0.08]"
                        aria-hidden
                      >
                        <span
                          className="block h-full bg-[#d7ff3e]"
                          style={{ width: `${Math.min(item.percentage, 100)}%` }}
                        />
                      </span>
                    </span>
                  ),
                },
              ]}
            />
          </div>
        </SectionCard>
      )}
    </div>
  );
}
