import { formatCurrency } from '@hominem/utils';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  EmptyState,
  Spinner,
} from '@ponti-studios/ui/feedback';
import { SectionIntro } from '@ponti-studios/ui/layout';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@ponti-studios/ui/primitives';
import {
  AlertTriangle,
  Building2,
  CreditCard,
  ExternalLink,
  Eye,
  EyeOff,
  RefreshCcw,
} from 'lucide-react';
import { useState } from 'react';

import { RouteLink } from '~/components/route-link';
import { createServerHonoClient } from '~/lib/api.server';
import { useAllAccounts } from '~/lib/hooks/use-finance-data';
import { requireAuth } from '~/lib/require-auth.server';

import type { Route } from './+types/accounts';

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  const { finance } = createServerHonoClient(request);

  const data = await finance.accounts.all
    .$get({ query: {} })
    .then((r) => r.json())
    .catch(() => ({ accounts: [] }));

  return data;
}

function AccountRow({
  account,
}: {
  account: ReturnType<typeof useAllAccounts>['accounts'][number];
}) {
  const [isBalanceVisible, setIsBalanceVisible] = useState(true);

  const typeIcon =
    account.accountType.toLowerCase() === 'credit' ? (
      <CreditCard className="size-4" aria-hidden />
    ) : (
      <Building2 className="size-4" aria-hidden />
    );

  return (
    <div className="grid gap-3 border-b border-border-subtle px-4 py-4 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-6 sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <div className="rounded-lg border border-border bg-accent-subtle p-2 text-primary">
          {typeIcon}
        </div>
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{account.name}</p>
          <p className="body-3 truncate text-muted-foreground">
            {`${account.accountType.charAt(0).toUpperCase()}${account.accountType.slice(1)}`}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 sm:justify-end">
        <div className="min-w-0 sm:text-right">
          <p className="body-4 text-muted-foreground">Balance</p>
          <p className="font-mono text-base font-semibold tabular-nums text-foreground">
            {account.currentBalance != null
              ? isBalanceVisible
                ? formatCurrency(Number(account.currentBalance))
                : '••••••'
              : '—'}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsBalanceVisible(!isBalanceVisible)}
          aria-label={isBalanceVisible ? 'Hide balance' : 'Show balance'}
        >
          {isBalanceVisible ? (
            <EyeOff className="size-4" aria-hidden />
          ) : (
            <Eye className="size-4" aria-hidden />
          )}
        </Button>
      </div>

      <Button className="w-full sm:w-auto" variant="outline" size="sm" asChild>
        <RouteLink to={`/accounts/${account.id}`}>
          <ExternalLink className="size-4" aria-hidden />
          Details
        </RouteLink>
      </Button>
    </div>
  );
}

export default function AccountsPage({ loaderData }: Route.ComponentProps) {
  const { accounts: initialAccounts } = loaderData;

  const allAccountsQuery = useAllAccounts({
    initialData: {
      accounts: initialAccounts,
    },
  });

  const isLoading = allAccountsQuery.isLoading;
  const hasError = allAccountsQuery.error;
  const hasAccounts = (allAccountsQuery.accounts || []).length > 0;

  const sortedAccounts = [...(allAccountsQuery.accounts || [])].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  return (
    <div className="flex flex-col gap-6">
      <SectionIntro
        title="Accounts"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => allAccountsQuery.refetch()}
              disabled={isLoading}
            >
              <RefreshCcw className="size-4" aria-hidden />
              Refresh
            </Button>
          </div>
        }
      />

      {hasError ? (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Error loading data</AlertTitle>
          <AlertDescription>
            {allAccountsQuery.error?.message || 'Failed to load banking data'}
          </AlertDescription>
        </Alert>
      ) : null}

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="md" />
        </div>
      ) : null}

      {!isLoading && !hasAccounts && !hasError ? (
        <EmptyState
          variant="dashed"
          title="No accounts yet"
          description="Accounts you add will appear here."
          icon={<Building2 className="size-5" aria-hidden />}
        />
      ) : null}

      {hasAccounts ? (
        <div>
          <Card className="overflow-hidden">
            <CardHeader className="border-b border-border bg-muted/50 px-4 py-3 sm:px-5">
              <CardTitle className="body-3 uppercase tracking-wide text-muted-foreground">
                Account ledger
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {sortedAccounts.map((account) => (
                <AccountRow key={account.id} account={account} />
              ))}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
