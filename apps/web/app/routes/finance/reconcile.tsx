import { Alert, AlertDescription, AlertTitle } from '@ponti-studios/ui/feedback';
import { Button } from '@ponti-studios/ui/primitives';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Form, Link, data, useActionData, useNavigation, useRevalidator } from 'react-router';

import { PageHeader, SectionCard } from '~/components/design';
import { DataTable } from '~/components/design/data-table';
import { SelectField } from '~/components/design/form-field';
import { FormGrid, TextInput } from '~/components/design/forms';
import { Badge } from '~/components/ui/badge';
import { parseTrueUpForm } from '~/modules/finance/lib/inputs';
import { formatCurrency } from '~/modules/finance/lib/number.utils';
import { createFinanceServerClient } from '~/modules/finance/lib/server-client';

import type { Route } from './+types/reconcile';

const BREAKDOWN_ROW_LIMIT = 50;

export async function loader({ request }: Route.LoaderArgs) {
  const finance = createFinanceServerClient(request);
  const accountId = new URL(request.url).searchParams.get('accountId')?.trim() || null;

  const [reconcile, breakdown] = await Promise.all([
    finance.ledger.reconcile.$get().then((response) => response.json()),
    accountId
      ? finance.ledger.accounts[':id']
          .$get({ param: { id: accountId } })
          .then((response) => (response.ok ? response.json() : null))
      : Promise.resolve(null),
  ]);

  return { staleness: reconcile.staleness, gates: reconcile.gates, breakdown, accountId };
}

export async function action({ request }: Route.ActionArgs) {
  const parsed = parseTrueUpForm(await request.formData());
  if (!parsed.ok) return data({ ok: false as const, error: parsed.error }, { status: 400 });

  const response = await createFinanceServerClient(request).ledger.adjustment.$post({
    json: parsed.value,
  });
  if (!response.ok) {
    let message = 'Reconciliation failed.';
    try {
      const body: unknown = await response.json();
      if (
        typeof body === 'object' &&
        body !== null &&
        'message' in body &&
        typeof body.message === 'string'
      ) {
        message = body.message;
      }
    } catch {
      // keep the fallback message
    }
    return data({ ok: false as const, error: message }, { status: 400 });
  }

  return { ok: true as const, result: await response.json() };
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ReconcilePage({ loaderData }: Route.ComponentProps) {
  const { staleness, gates, breakdown, accountId } = loaderData;
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const revalidator = useRevalidator();
  const submitting = navigation.state === 'submitting';

  const [trueUpAccount, setTrueUpAccount] = useState('');

  useEffect(() => {
    if (actionData?.ok) revalidator.revalidate();
  }, [actionData, revalidator]);

  const accountNames = new Map(staleness.map((entry) => [entry.accountId, entry.accountName]));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader eyebrow="Finance · Reconcile" title="Reconcile" />

      {actionData && !actionData.ok ? (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>True-up failed</AlertTitle>
          <AlertDescription>{actionData.error}</AlertDescription>
        </Alert>
      ) : null}
      {actionData?.ok && actionData.result.alreadyReconciled ? (
        <Alert>
          <CheckCircle2 className="size-4" />
          <AlertTitle>Already reconciled</AlertTitle>
          <AlertDescription>
            {actionData.result.accountName} matches to the cent — nothing posted.
          </AlertDescription>
        </Alert>
      ) : null}

      <SectionCard>
        <div className="p-5 sm:p-6">
          <h2 className="text-[15px] font-semibold text-foreground">Reconciliation staleness</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Last reconciling entry per account, stalest first. Balances are plain ledger sums.
          </p>
          <div className="mt-4">
            <DataTable
              ariaLabel="Reconciliation staleness by account"
              rows={staleness}
              keyOf={(entry) => entry.accountId}
              columns={[
                {
                  key: 'account',
                  header: 'Account',
                  render: (entry) => (
                    <span className="inline-flex items-center gap-2">
                      {entry.accountName}
                      <Badge variant="outline">{entry.accountType}</Badge>
                    </span>
                  ),
                },
                {
                  key: 'balance',
                  header: 'Balance',
                  align: 'right',
                  render: (entry) => formatCurrency(entry.balance),
                },
                {
                  key: 'last',
                  header: 'Last reconciled',
                  align: 'right',
                  render: (entry) => entry.lastReconciled ?? 'never',
                },
                {
                  key: 'inspect',
                  header: 'Inspect',
                  align: 'right',
                  tabular: false,
                  render: (entry) => (
                    <Link
                      to={`/finance/reconcile?accountId=${entry.accountId}`}
                      className="text-foreground hover:underline"
                    >
                      Ledger
                    </Link>
                  ),
                },
              ]}
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard>
        <div className="p-5 sm:p-6">
          <h2 className="text-[15px] font-semibold text-foreground">True-up an account</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Post a dated adjustment entry that closes the gap to a real balance reading. Uses
            money-out-negative signs: a debt owed is negative.
          </p>
          <Form method="post" className="mt-4">
            <FormGrid>
              <SelectField
                label="Account"
                name="accountId"
                value={trueUpAccount}
                onChange={setTrueUpAccount}
                required
                placeholder="Choose an account"
                options={staleness.map((entry) => ({
                  value: entry.accountId,
                  label: entry.accountName,
                }))}
              />
              <TextInput
                label="True balance"
                name="balance"
                type="number"
                step="0.01"
                required
                placeholder="-2717.99"
              />
              <TextInput label="As-of date" name="date" type="date" defaultValue={todayIso()} />
              <TextInput label="Note" name="note" type="text" placeholder="Copilot reading" />
            </FormGrid>
            <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-foreground">
              <input type="checkbox" name="force" className="size-4 accent-primary" />
              Post even if an adjustment already exists for that date
            </label>
            <div className="mt-4">
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Posting…' : 'Post adjustment'}
              </Button>
            </div>
          </Form>
        </div>
      </SectionCard>

      {accountId ? (
        <SectionCard>
          <div className="p-5 sm:p-6">
            <h2 className="text-[15px] font-semibold text-foreground">Ledger breakdown</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {breakdown
                ? `${breakdown.accountName} · ledger ${formatCurrency(breakdown.balance)} · per-description signs`
                : 'Unknown account.'}
            </p>
            {breakdown ? (
              <div className="mt-4">
                <DataTable
                  ariaLabel="Ledger breakdown by description"
                  rows={breakdown.rows.slice(0, BREAKDOWN_ROW_LIMIT)}
                  keyOf={(row) => row.description}
                  columns={[
                    { key: 'desc', header: 'Description', render: (row) => row.description || '—' },
                    { key: 'n', header: 'n', align: 'right', render: (row) => String(row.count) },
                    {
                      key: 'pm',
                      header: '+/−',
                      align: 'right',
                      render: (row) => `${row.positiveCount}/${row.negativeCount}`,
                    },
                    {
                      key: 'signed',
                      header: 'Signed',
                      align: 'right',
                      render: (row) => (
                        <span className={row.signedSum < 0 ? 'text-destructive-text' : undefined}>
                          {formatCurrency(row.signedSum)}
                        </span>
                      ),
                    },
                    {
                      key: 'abs',
                      header: 'Abs',
                      align: 'right',
                      render: (row) => formatCurrency(row.absSum),
                    },
                  ]}
                />
                {breakdown.rows.length > BREAKDOWN_ROW_LIMIT ? (
                  <p className="pt-3 font-mono text-[11px] text-muted-foreground">
                    Showing {BREAKDOWN_ROW_LIMIT} of {breakdown.rows.length} descriptions.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </SectionCard>
      ) : null}

      <SectionCard>
        <div className="p-5 sm:p-6">
          <h2 className="text-[15px] font-semibold text-foreground">Ledger health</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {gates.totalTransactions} transactions · {gates.uncategorizedTransactions} uncategorized
            · {gates.accountsWithNoTransactions.length} empty accounts
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant={gates.orphanTransactions === 0 ? 'outline' : 'destructive'}>
              {gates.orphanTransactions} orphaned
            </Badge>
            <Badge variant={gates.duplicateGroupCount === 0 ? 'outline' : 'destructive'}>
              {gates.duplicateGroupCount} duplicate groups
            </Badge>
            <Badge variant={gates.signViolationCount === 0 ? 'outline' : 'destructive'}>
              {gates.signViolationCount} sign violations
            </Badge>
          </div>
          {gates.signViolations.length > 0 ? (
            <div className="mt-4">
              <DataTable
                ariaLabel="Sign violations"
                rows={gates.signViolations}
                keyOf={(entry) => entry.transactionId}
                columns={[
                  {
                    key: 'account',
                    header: 'Account',
                    render: (entry) => accountNames.get(entry.accountId) ?? '—',
                  },
                  { key: 'type', header: 'Type', render: (entry) => entry.transactionType },
                  {
                    key: 'amount',
                    header: 'Amount',
                    align: 'right',
                    render: (entry) => formatCurrency(entry.amount),
                  },
                ]}
              />
            </div>
          ) : null}
          {gates.duplicateGroups.length > 0 ? (
            <div className="mt-4">
              <p className="mb-1 text-sm font-medium text-foreground">Duplicate candidates</p>
              <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
                {gates.duplicateGroups.slice(0, 10).map((group, index) => (
                  <li key={`${group.accountId}-${group.postedOn}-${group.absoluteAmount}-${index}`}>
                    {group.count}× {formatCurrency(group.absoluteAmount)} ·{' '}
                    {accountNames.get(group.accountId) ?? '—'} · {group.postedOn} ·{' '}
                    {group.description || '—'}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {gates.accountsWithNoTransactions.length > 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Empty: {gates.accountsWithNoTransactions.map((entry) => entry.accountName).join(', ')}
            </p>
          ) : null}
        </div>
      </SectionCard>
    </div>
  );
}
