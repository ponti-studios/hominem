import { CHART_COLORS } from '@ponti-studios/ui';
import { AlertTriangle, Calendar, DollarSign, TrendingDown } from 'lucide-react';
import { useMemo, useState } from 'react';
import { data, useFetcher } from 'react-router';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  ChartCard,
  DataTable,
  Field,
  PageHeader,
  PanelState,
  SectionCard,
  SelectField,
  Stat,
} from '~/components/design';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { BudgetCapForm } from '~/modules/finance/components/finance/budget-cap-form';
import { useCalculateRunway } from '~/modules/finance/hooks/use-runway';
import { formatCurrency } from '~/modules/finance/lib/number.utils';
import { createFinanceServerClient } from '~/modules/finance/lib/server-client';

import type { Route } from './+types/runway';

export async function loader({ request }: Route.LoaderArgs) {
  const { settings, runway } = await createFinanceServerClient(request)
    .ledger.runway.$get()
    .then((response) => response.json());
  return { live: runway, settings };
}

export async function action({ request }: Route.ActionArgs) {
  const finance = createFinanceServerClient(request);
  const form = await request.formData();
  const actionName = String(form.get('intent') ?? '');

  if (actionName === 'currency') {
    const currencyCode = String(form.get('currencyCode') ?? '');
    if (!/^[A-Z]{3}$/.test(currencyCode)) {
      return data({ error: 'Choose a valid currency.' }, { status: 400 });
    }
    await finance.runway.settings.currency.$post({ json: { currencyCode } });
  } else if (actionName === 'budget') {
    const amount = Number(form.get('amount'));
    const categoryId = String(form.get('categoryId') ?? '');
    const currencyCode = String(form.get('currencyCode') ?? '');
    if (!Number.isFinite(amount) || amount < 0 || !/^[A-Z]{3}$/.test(currencyCode)) {
      return data({ error: 'Enter a valid amount and currency.' }, { status: 400 });
    }
    await finance.runway.settings.budget.$post({
      json: { categoryId, amount, currencyCode },
    });
  } else if (actionName === 'remove-budget') {
    await finance.runway.settings.budget.delete.$post({
      json: { budgetId: String(form.get('budgetId') ?? '') },
    });
  }

  return data({ ok: true });
}

interface PlannedPurchase {
  description: string;
  amount: number;
  date: string;
}

export default function RunwayPage({ loaderData }: Route.ComponentProps) {
  const { live, settings } = loaderData;
  const settingsFetcher = useFetcher();

  const [initialBalance, setInitialBalance] = useState(0);
  const [monthlyExpenses, setMonthlyExpenses] = useState(0);
  const [plannedPurchases, setPlannedPurchases] = useState<PlannedPurchase[]>([]);
  const [newPurchase, setNewPurchase] = useState<PlannedPurchase>({
    description: '',
    amount: 0,
    date: '',
  });

  const runwayMutation = useCalculateRunway();

  const chartData = useMemo(() => {
    const response = runwayMutation.data;
    if (!response?.projectionData) {
      return [];
    }
    return response.projectionData;
  }, [runwayMutation.data]);

  const runwayMetrics = useMemo(() => {
    const response = runwayMutation.data;
    if (!response) {
      return {
        monthsUntilZero: 0,
        zeroDate: new Date(),
        minimumBalance: 0,
        isRunwayDangerous: false,
        totalPlannedExpenses: 0,
      };
    }

    const data = response;
    if (!data)
      return {
        monthsUntilZero: 0,
        zeroDate: new Date(),
        minimumBalance: 0,
        isRunwayDangerous: false,
        totalPlannedExpenses: 0,
      };
    const zeroDate = data.runwayEndDate ? new Date(data.runwayEndDate) : null;
    const minimumBalance = Math.min(...chartData.map((d: { balance: number }) => d.balance));

    return {
      monthsUntilZero: data.runwayMonths,
      zeroDate,
      minimumBalance,
      isRunwayDangerous: data.isRunwayDangerous,
      totalPlannedExpenses: data.totalPlannedExpenses,
    };
  }, [runwayMutation.data, chartData]);

  const handleAddPurchase = () => {
    if (newPurchase.description && newPurchase.amount > 0 && newPurchase.date) {
      const updatedPurchases = [...plannedPurchases, newPurchase];
      setPlannedPurchases(updatedPurchases);
      setNewPurchase({ description: '', amount: 0, date: '' });

      if (initialBalance >= 0 && monthlyExpenses >= 0) {
        runwayMutation.mutate({
          balance: initialBalance,
          monthlyExpenses,
          plannedPurchases: updatedPurchases,
        });
      }
    }
  };

  const handleRemovePurchase = (index: number) => {
    const updatedPurchases = plannedPurchases.filter((_, i) => i !== index);
    setPlannedPurchases(updatedPurchases);

    if (initialBalance >= 0 && monthlyExpenses >= 0) {
      runwayMutation.mutate({
        balance: initialBalance,
        monthlyExpenses,
        plannedPurchases: updatedPurchases,
      });
    }
  };

  const handleCalculateRunway = () => {
    if (initialBalance >= 0 && monthlyExpenses >= 0) {
      runwayMutation.mutate({
        balance: initialBalance,
        monthlyExpenses,
        plannedPurchases,
      });
    }
  };

  const handleInputChange = (field: 'initialBalance' | 'monthlyExpenses', value: number) => {
    runwayMutation.reset();
    if (field === 'initialBalance') {
      setInitialBalance(value);
    } else {
      setMonthlyExpenses(value);
    }

    const newBalance = field === 'initialBalance' ? value : initialBalance;
    const newMonthlyExpenses = field === 'monthlyExpenses' ? value : monthlyExpenses;

    if (newBalance >= 0 && newMonthlyExpenses >= 0) {
      runwayMutation.mutate({
        balance: newBalance,
        monthlyExpenses: newMonthlyExpenses,
        plannedPurchases,
      });
    }
  };

  const currency = live?.currencyCode ?? 'USD';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Finance · Runway"
        title="Financial Runway Calculator"
        description={
          live
            ? `Forecast currency: ${live.currencyCode ?? 'Not selected'}`
            : 'Live ledger forecast plus manual scenarios.'
        }
        accent="#9d7bff"
        actions={
          runwayMetrics.isRunwayDangerous ? (
            <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-[#ff6b6b]/15 px-3 text-[13px] font-medium text-[#ff9d9d]">
              <AlertTriangle aria-hidden className="size-3.5" />
              Short Runway
            </span>
          ) : undefined
        }
      />

      {live ? (
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 md:grid-cols-4">
            <SectionCard index={0}>
              <div className="p-5">
                <Stat
                  label="Ledger Cash"
                  value={formatCurrency(live.startingCash, currency)}
                  sub={`Across ${live.liquidAccounts.length} liquid accounts, as of ${live.asOfDate}`}
                />
                <DollarSign aria-hidden className="mt-3 size-4 text-[#5e6678]" />
              </div>
            </SectionCard>
            <SectionCard index={1}>
              <div className="p-5">
                <Stat
                  label="Weekly Burn"
                  value={formatCurrency(
                    live.weeklyRecurringOutflow + live.weeklyVariableAllowance,
                    currency,
                  )}
                  sub={`${formatCurrency(live.weeklyRecurringOutflow, currency)} recurring · ${formatCurrency(live.weeklyVariableAllowance, currency)} allowance`}
                />
                <TrendingDown aria-hidden className="mt-3 size-4 text-[#5e6678]" />
              </div>
            </SectionCard>
            <SectionCard index={2}>
              <div className="p-5">
                <Stat
                  label="Projected Ending"
                  value={formatCurrency(
                    live.weeks[live.weeks.length - 1]?.endingCash ?? live.startingCash,
                    currency,
                  )}
                  sub={`After ${live.weeks.length} weeks at the current burn`}
                />
                <Calendar aria-hidden className="mt-3 size-4 text-[#5e6678]" />
              </div>
            </SectionCard>
            <SectionCard index={3}>
              <div className="p-5">
                <Stat
                  label="Recurring Basis"
                  value={String(live.recurringTxnCount)}
                  sub={`Recurring debits in the trailing ${live.recurringLookbackMonths} months`}
                />
                <TrendingDown aria-hidden className="mt-3 size-4 text-[#5e6678]" />
              </div>
            </SectionCard>
          </div>

          <SectionCard index={4}>
            <div className="p-5 sm:p-6">
              <h2 className="text-[15px] font-semibold text-[#f2f4f8]">Live trajectory</h2>
              <div className="mt-3">
                <DataTable
                  ariaLabel="Weekly runway trajectory"
                  columns={[
                    {
                      key: 'week',
                      header: 'Week',
                      render: (week) => (
                        <span>
                          {week.week} · {week.weekStart}
                        </span>
                      ),
                    },
                    {
                      key: 'starting',
                      header: 'Starting',
                      render: (week) => formatCurrency(week.beginningCash, currency),
                    },
                    {
                      key: 'net',
                      header: 'Net change',
                      align: 'right',
                      render: (week) => formatCurrency(week.netChange, currency),
                    },
                    {
                      key: 'ending',
                      header: 'Ending',
                      align: 'right',
                      render: (week) => formatCurrency(week.endingCash, currency),
                    },
                  ]}
                  rows={live.weeks.slice(0, 8)}
                  keyOf={(week) => `week-${week.week}`}
                />
              </div>
              {live.weeklyVariableAllowance === 0 ? (
                <p className="pt-3 text-[13px] text-[#9ba3b4]">
                  No monthly budgets configured yet, so the variable allowance is{' '}
                  {formatCurrency(0, currency)} — this shows recurring burn only.
                </p>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard index={5}>
            <div className="p-5 sm:p-6">
              <h2 className="text-[15px] font-semibold text-[#f2f4f8]">Forecast settings</h2>
              <div className="mt-4 flex flex-col gap-5">
                <settingsFetcher.Form method="post" className="flex flex-wrap items-end gap-3">
                  <input type="hidden" name="intent" value="currency" />
                  <SelectField
                    label="Forecast currency"
                    name="currencyCode"
                    required
                    defaultValue={settings?.currencyCode ?? ''}
                    placeholder="Choose currency"
                    options={(settings?.currencies ?? []).map((code) => ({
                      value: code,
                      label: code,
                    }))}
                  />
                  <Button type="submit" disabled={settingsFetcher.state !== 'idle'}>
                    Save currency
                  </Button>
                </settingsFetcher.Form>
                {live.warnings.map((warning) => (
                  <p key={warning} className="text-sm text-[#ffc53d]">
                    {warning}
                  </p>
                ))}
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-medium text-[#f2f4f8]">Monthly category caps</h3>
                  {settings?.budgets
                    .filter((budget) => budget.currencyCode === settings.currencyCode)
                    .map((budget) => (
                      <div
                        key={budget.id}
                        className="flex items-center justify-between gap-3 border-t border-white/[0.06] py-2 text-sm"
                      >
                        <span className="text-[#f2f4f8]">
                          {budget.category} · {budget.currencyCode}
                        </span>
                        <div className="flex items-center gap-2">
                          <BudgetCapForm
                            layout="inline"
                            hiddenFields={{
                              categoryId: budget.categoryId,
                              currencyCode: budget.currencyCode,
                            }}
                            defaultAmount={budget.amount}
                            submitLabel="Save"
                          />
                          <settingsFetcher.Form method="post">
                            <input type="hidden" name="intent" value="remove-budget" />
                            <input type="hidden" name="budgetId" value={budget.id} />
                            <Button type="submit" variant="outline" size="sm">
                              Remove
                            </Button>
                          </settingsFetcher.Form>
                        </div>
                      </div>
                    ))}
                  <div className="border-t border-white/[0.06] pt-3">
                    <BudgetCapForm
                      hiddenFields={{ currencyCode: settings?.currencyCode ?? '' }}
                      submitLabel="Save cap"
                      disabled={!settings?.currencyCode}
                      leading={
                        <SelectField
                          label="Category"
                          name="categoryId"
                          required
                          placeholder="Choose category"
                          options={(settings?.categories ?? []).map((category) => ({
                            value: category.id,
                            label: category.name,
                          }))}
                        />
                      }
                    />
                  </div>
                  {settingsFetcher.data && 'error' in settingsFetcher.data && (
                    <p role="alert" className="text-sm text-[#ff9d9d]">
                      {settingsFetcher.data.error}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      ) : null}

      {runwayMutation.isError && (
        <PanelState
          title="Unable to calculate the scenario"
          description={runwayMutation.error.message || 'Please try again.'}
        />
      )}

      {chartData.length > 0 && (
        <div className="grid gap-4 md:grid-cols-4">
          <SectionCard>
            <div className="p-5">
              <Stat label="Current Balance" value={formatCurrency(initialBalance)} />
              <DollarSign aria-hidden className="mt-3 size-4 text-[#5e6678]" />
            </div>
          </SectionCard>
          <SectionCard>
            <div className="p-5">
              <Stat label="Monthly Burn Rate" value={formatCurrency(monthlyExpenses)} />
              <TrendingDown aria-hidden className="mt-3 size-4 text-[#5e6678]" />
            </div>
          </SectionCard>
          <SectionCard>
            <div className="p-5">
              <Stat
                label="Runway (Months)"
                value={
                  runwayMetrics.monthsUntilZero === null
                    ? 'No depletion in 12 months'
                    : String(runwayMetrics.monthsUntilZero)
                }
                sub={
                  runwayMetrics.zeroDate !== null
                    ? `Until ${runwayMetrics.zeroDate.toLocaleDateString()}`
                    : undefined
                }
                accent={runwayMetrics.isRunwayDangerous ? '#ff6b6b' : undefined}
              />
              <Calendar aria-hidden className="mt-3 size-4 text-[#5e6678]" />
            </div>
          </SectionCard>
          <SectionCard>
            <div className="p-5">
              <Stat
                label="Minimum Balance"
                value={formatCurrency(runwayMetrics.minimumBalance)}
                accent={runwayMetrics.minimumBalance < 0 ? '#ff6b6b' : undefined}
              />
              <TrendingDown aria-hidden className="mt-3 size-4 text-[#5e6678]" />
            </div>
          </SectionCard>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard>
          <div className="p-5 sm:p-6">
            <h2 className="text-[15px] font-semibold text-[#f2f4f8]">Manual Scenario</h2>
            <p className="mt-1 text-sm text-[#9ba3b4]">
              These inputs are independent of your ledger forecast.
            </p>
            <div className="mt-4 flex flex-col gap-4">
              <Field label="Manually entered starting balance ($)">
                {(id) => (
                  <Input
                    type="number"
                    id={id}
                    value={initialBalance}
                    onChange={(e) => handleInputChange('initialBalance', Number(e.target.value))}
                  />
                )}
              </Field>
              <Field label="Manually entered monthly expenses ($)">
                {(id) => (
                  <Input
                    type="number"
                    id={id}
                    value={monthlyExpenses}
                    onChange={(e) => handleInputChange('monthlyExpenses', Number(e.target.value))}
                  />
                )}
              </Field>
              <div>
                <Button
                  onClick={handleCalculateRunway}
                  disabled={initialBalance < 0 || monthlyExpenses < 0 || runwayMutation.isPending}
                >
                  {runwayMutation.isPending ? 'Calculating...' : 'Calculate Runway'}
                </Button>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard>
          <div className="p-5 sm:p-6">
            <h2 className="text-[15px] font-semibold text-[#f2f4f8]">Add Planned Purchase</h2>
            <div className="mt-4 flex flex-col gap-4">
              <Field label="Description">
                {(id) => (
                  <Input
                    id={id}
                    placeholder="e.g., New laptop"
                    value={newPurchase.description}
                    onChange={(e) =>
                      setNewPurchase({ ...newPurchase, description: e.target.value })
                    }
                  />
                )}
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Amount ($)">
                  {(id) => (
                    <Input
                      type="number"
                      id={id}
                      placeholder="0"
                      value={newPurchase.amount}
                      onChange={(e) =>
                        setNewPurchase({ ...newPurchase, amount: Number(e.target.value) })
                      }
                    />
                  )}
                </Field>
                <Field label="Date">
                  {(id) => (
                    <Input
                      type="date"
                      id={id}
                      value={newPurchase.date}
                      onChange={(e) => setNewPurchase({ ...newPurchase, date: e.target.value })}
                    />
                  )}
                </Field>
              </div>
              <div>
                <Button
                  onClick={handleAddPurchase}
                  disabled={
                    !newPurchase.description || newPurchase.amount <= 0 || !newPurchase.date
                  }
                >
                  Add Purchase
                </Button>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      {plannedPurchases.length > 0 && (
        <SectionCard>
          <div className="p-5 sm:p-6">
            <h2 className="text-[15px] font-semibold text-[#f2f4f8]">Planned Purchases</h2>
            <DataTable
              ariaLabel="Planned purchases"
              columns={[
                {
                  key: 'purchase',
                  header: 'Purchase',
                  render: (purchase) => (
                    <span>
                      <span className="font-medium">{purchase.description}</span>{' '}
                      <span className="text-sm text-[#9ba3b4]">
                        on {new Date(purchase.date).toLocaleDateString()}
                      </span>
                    </span>
                  ),
                },
                {
                  key: 'amount',
                  header: 'Amount',
                  align: 'right',
                  render: (purchase) => (
                    <span className="font-semibold">{formatCurrency(purchase.amount)}</span>
                  ),
                },
                {
                  key: 'actions',
                  header: '',
                  align: 'right',
                  tabular: false,
                  render: (_purchase, index) => (
                    <Button variant="outline" size="sm" onClick={() => handleRemovePurchase(index)}>
                      Remove
                    </Button>
                  ),
                },
              ]}
              rows={plannedPurchases}
              keyOf={(purchase, index) => `${purchase.description}-${purchase.date}-${index}`}
            />
            <div className="flex items-center justify-between border-t border-white/[0.06] pt-3 font-semibold text-[#f2f4f8]">
              <span>Total Planned Expenses:</span>
              <span>{formatCurrency(runwayMetrics.totalPlannedExpenses)}</span>
            </div>
          </div>
        </SectionCard>
      )}

      {chartData.length > 0 && (
        <ChartCard title="12-Month Scenario Projection" height="lg" state="ready">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#9ba3b4', fontSize: 11 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#9ba3b4', fontSize: 11 }}
                tickFormatter={(value) => formatCurrency(value)}
              />
              <Tooltip
                formatter={(value) => [formatCurrency(Number(value)), 'Projected Balance']}
                labelStyle={{ color: CHART_COLORS.neutral }}
                contentStyle={{
                  backgroundColor: '#12161d',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  color: '#f2f4f8',
                }}
              />
              <ReferenceLine y={0} stroke={CHART_COLORS.negative} strokeDasharray="2 2" />
              <Line
                type="monotone"
                dataKey="balance"
                stroke="#d7ff3e"
                strokeWidth={2.5}
                dot={(props) => {
                  const { cx, cy, payload } = props;
                  const isNegative = payload?.balance < 0;
                  return (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={4}
                      fill={isNegative ? CHART_COLORS.negative : '#d7ff3e'}
                      stroke={isNegative ? CHART_COLORS.negative : '#d7ff3e'}
                      strokeWidth={2}
                    />
                  );
                }}
                activeDot={{ r: 6, stroke: '#d7ff3e', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </div>
  );
}
