import { Skeleton } from '@ponti-studios/ui/feedback';
import { Badge } from '@ponti-studios/ui/primitives';
import { Card, CardContent, CardHeader, CardTitle } from '@ponti-studios/ui/primitives';

import { useTagBreakdown } from '~/modules/finance/hooks/use-analytics';
import { formatCurrency } from '~/modules/finance/lib/number.utils';

interface TopTagsProps {
  dateFrom?: Date | undefined;
  dateTo?: Date | undefined;
  selectedAccount?: string | undefined;
}

export function TopTags({ dateFrom, dateTo, selectedAccount }: TopTagsProps) {
  const {
    data: categoryBreakdown,
    isLoading,
    error,
  } = useTagBreakdown({
    from: dateFrom,
    to: dateTo,
    account: selectedAccount,
    limit: 50,
  });
  const topTags = categoryBreakdown?.breakdown
    .filter((item) => item.tag !== '(untagged)')
    .slice(0, 5);

  if (!isLoading && !error && !topTags?.length) return null;

  const skeletonItems = Array.from({ length: 5 }, (_, i) => i);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Tags</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {skeletonItems.map((item) => (
              <div key={`category-skeleton-${item}`} className="flex justify-between items-center">
                <Skeleton className="h-4 w-24" />
                <div className="flex gap-4">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-8" />
                </div>
              </div>
            ))}
          </div>
        ) : error instanceof Error ? (
          <div className="text-destructive">
            {error.message || 'Categories unavailable. Retry later.'}
          </div>
        ) : error ? (
          <div className="text-destructive">An unknown error occurred while fetching tags.</div>
        ) : topTags ? (
          <div className="space-y-3">
            {topTags.map((cat) => {
              const tagLabel = cat.tag;
              return (
                <div
                  key={`${cat.currencyCode}-${tagLabel}`}
                  className="grid grid-cols-[auto_1fr_auto] gap-3 items-center"
                >
                  <Badge variant="secondary">{cat.transactionCount}x</Badge>
                  <span className="text-sm">{tagLabel}</span>
                  <span className="text-sm font-mono text-right">
                    {formatCurrency(cat.amount, cat.currencyCode)}
                  </span>
                </div>
              );
            })}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
