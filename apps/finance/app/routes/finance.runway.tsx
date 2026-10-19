import { CHART_COLORS } from '@ponti-studios/ui';
import { Input } from '@ponti-studios/ui/forms';
import { Badge } from '@ponti-studios/ui/primitives';
import { Button } from '@ponti-studios/ui/primitives';
import { Card, CardContent, CardHeader, CardTitle } from '@ponti-studios/ui/primitives';
import { AlertTriangle, Calendar, DollarSign, TrendingDown } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
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

import { getServerSession } from '~/lib/auth.server';
import {
  getLiveRunway,
  getRunwaySettings,
  removeRunwayBudget,
  saveRunwayBudget,
  saveRunwayCurrency,
} from '~/lib/finance/ledger.server';
import { useCalculateRunway } from '~/lib/hooks/use-runway';
import { formatCurrency } from '~/lib/number.utils';

import type { Route } from './+types/finance.runway';

export async function loader({ request }: Route.LoaderArgs) {
  const { user, headers } = await getServerSession(request);
  if (!user?.id) return data({ live: null, settings: null }, { headers });
  const [live, settings] = await Promise.all([getLiveRunway(user.id), getRunwaySettings(user.id)]);
  return data({ live, settings }, { headers });
}

export async function action({ request }: Route.ActionArgs) {
  const { user, headers } = await getServerSession(request);
  if (!user?.id) return data({ error: 'Unauthorized' }, { status: 401, headers });
  const form = await request.formData();
  const actionName = String(form.get('intent') ?? '');
  if (actionName === 'currency') {
    const currencyCode = String(form.get('currencyCode') ?? '');
    if (!/^[A-Z]{3}$/.test(currencyCode))
      return data({ error: 'Choose a valid currency.' }, { status: 400, headers });
    await saveRunwayCurrency(user.id, currencyCode);
  } else if (actionName === 'budget') {
    const amount = Number(form.get('amount'));
    const categoryId = String(form.get('categoryId') ?? '');
    const currencyCode = String(form.get('currencyCode') ?? '');
    if (!Number.isFinite(amount) || amount < 0 || !/^[A-Z]{3}$/.test(currencyCode)) {
      return data({ error: 'Enter a valid amount and currency.' }, { status: 400, headers });
    }
    await saveRunwayBudget({ userId: user.id, categoryId, amount, currencyCode });
  } else if (actionName === 'remove-budget') {
    await removeRunwayBudget(user.id, String(form.get('budgetId') ?? ''));
  }
  return data({ ok: true }, { headers });
}

interface PlannedPurchase {
  description: string;
  amount: number;
  date: string;
}

export default function RunwayPage({ loaderData }: Route.ComponentProps) {
  const { live, settings } = loaderData;
  const settingsFetcher = useFetcher();
  const initialBalanceId = useId();
  const monthlyExpensesId = useId();
  const descriptionId = useId();
  const amountId = useId();
  const dateId = useId();

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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Financial Runway Calculator</h1>
        {runwayMetrics.isRunwayDangerous && (
          <Badge variant="destructive">
            <AlertTriangle className="size-4" />
            Short Runway
          </Badge>
        )}
      </div>

      {live ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Forecast currency: {live.currencyCode ?? 'Not selected'}
          </p>
          <div className="grid gap-6 md:grid-cols-4">
            <Card>
              <CardHeader>
                <CardTitle>Ledger Cash</CardTitle>
                <DollarSign className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(live.startingCash, live.currencyCode ?? 'USD')}
                </div>
                <p className="text-xs text-muted-foreground">
                  Across {live.liquidAccounts.length} liquid accounts, as of {live.asOfDate}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Weekly Burn</CardTitle>
                <TrendingDown className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(
                    live.weeklyRecurringOutflow + live.weeklyVariableAllowance,
                    live.currencyCode ?? 'USD',
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(live.weeklyRecurringOutflow, live.currencyCode ?? 'USD')}{' '}
                  recurring ·{' '}
                  {formatCurrency(live.weeklyVariableAllowance, live.currencyCode ?? 'USD')}{' '}
                  allowance
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Projected Ending</CardTitle>
                <Calendar className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(
                    live.weeks[live.weeks.length - 1]?.endingCash ?? live.startingCash,
                    live.currencyCode ?? 'USD',
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  After {live.weeks.length} weeks at the current burn
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Recurring Basis</CardTitle>
                <TrendingDown className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{live.recurringTxnCount}</div>
                <p className="text-xs text-muted-foreground">
                  Recurring debits in the trailing {live.recurringLookbackMonths} months
                </p>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Live trajectory</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Week</th>
                    <th className="pb-2 font-medium">Starting</th>
                    <th className="pb-2 text-right font-medium">Net change</th>
                    <th className="pb-2 text-right font-medium">Ending</th>
                  </tr>
                </thead>
                <tbody>
                  {live.weeks.slice(0, 8).map((week) => (
                    <tr key={week.week} className="border-t border-border">
                      <td className="py-2 tabular-nums">
                        {week.week} · {week.weekStart}
                      </td>
                      <td className="py-2 tabular-nums">
                        {formatCurrency(week.beginningCash, live.currencyCode ?? 'USD')}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {formatCurrency(week.netChange, live.currencyCode ?? 'USD')}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {formatCurrency(week.endingCash, live.currencyCode ?? 'USD')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {live.weeklyVariableAllowance === 0 ? (
                <p className="pt-2 text-xs text-muted-foreground">
                  No monthly budgets configured yet, so the variable allowance is{' '}
                  {formatCurrency(0, live.currencyCode ?? 'USD')} — this shows recurring burn only.
                </p>
              ) : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Forecast settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <settingsFetcher.Form method="post" className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="intent" value="currency" />
                <label className="grid gap-1 text-sm">
                  Forecast currency
                  <select
                    name="currencyCode"
                    required
                    defaultValue={settings?.currencyCode ?? ''}
                    className="h-10 rounded-md border border-input bg-background px-3"
                    aria-label="Forecast currency"
                  >
                    <option value="" disabled>
                      Choose currency
                    </option>
                    {settings?.currencies.map((currency) => (
                      <option key={currency} value={currency}>
                        {currency}
                      </option>
                    ))}
                  </select>
                </label>
                <Button type="submit" disabled={settingsFetcher.state !== 'idle'}>
                  Save currency
                </Button>
              </settingsFetcher.Form>
              {live.warnings.map((warning) => (
                <p key={warning} className="text-sm text-amber-600">
                  {warning}
                </p>
              ))}
              <div className="space-y-2">
                <h3 className="font-medium">Monthly category caps</h3>
                {settings?.budgets
                  .filter((budget) => budget.currencyCode === settings.currencyCode)
                  .map((budget) => (
                    <div
                      key={budget.id}
                      className="flex items-center justify-between gap-3 border-t border-border py-2 text-sm"
                    >
                      <span>
                        {budget.category} · {budget.currencyCode}
                      </span>
                      <settingsFetcher.Form method="post" className="flex items-center gap-2">
                        <input type="hidden" name="intent" value="budget" />
                        <input type="hidden" name="categoryId" value={budget.categoryId} />
                        <input type="hidden" name="currencyCode" value={budget.currencyCode} />
                        <Input
                          className="max-w-32"
                          aria-label={`${budget.category} monthly cap`}
                          name="amount"
                          type="number"
                          min="0"
                          step="0.01"
                          defaultValue={budget.amount}
                          required
                        />
                        <Button type="submit" variant="outline" size="sm">
                          Save
                        </Button>
                      </settingsFetcher.Form>
                      <settingsFetcher.Form method="post">
                        <input type="hidden" name="intent" value="remove-budget" />
                        <input type="hidden" name="budgetId" value={budget.id} />
                        <Button type="submit" variant="outline" size="sm">
                          Remove
                        </Button>
                      </settingsFetcher.Form>
                    </div>
                  ))}
                <settingsFetcher.Form
                  method="post"
                  className="flex flex-wrap items-end gap-3 border-t border-border pt-3"
                >
                  <input type="hidden" name="intent" value="budget" />
                  <label className="grid gap-1 text-sm">
                    Category
                    <select
                      name="categoryId"
                      required
                      className="h-10 rounded-md border border-input bg-background px-3"
                    >
                      <option value="" disabled selected>
                        Choose category
                      </option>
                      {settings?.categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm">
                    Monthly cap
                    <Input name="amount" type="number" min="0" step="0.01" required />
                  </label>
                  <input type="hidden" name="currencyCode" value={settings?.currencyCode ?? ''} />
                  <Button
                    type="submit"
                    disabled={!settings?.currencyCode || settingsFetcher.state !== 'idle'}
                  >
                    Save cap
                  </Button>
                </settingsFetcher.Form>
                {settingsFetcher.data && 'error' in settingsFetcher.data && (
                  <p role="alert" className="text-sm text-destructive">
                    {settingsFetcher.data.error}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {runwayMutation.isError && (
        <p role="alert" className="text-sm text-destructive">
          {runwayMutation.error.message || 'Unable to calculate the scenario. Please try again.'}
        </p>
      )}

      {chartData.length > 0 && (
        <div className="grid gap-6 md:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle>Current Balance</CardTitle>
              <DollarSign className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(initialBalance)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Monthly Burn Rate</CardTitle>
              <TrendingDown className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(monthlyExpenses)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Runway (Months)</CardTitle>
              <Calendar className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-bold ${runwayMetrics.isRunwayDangerous ? 'text-destructive' : 'text-foreground'}`}
              >
                {runwayMetrics.monthsUntilZero === null
                  ? 'No depletion in 12 months'
                  : runwayMetrics.monthsUntilZero}
              </div>
              {runwayMetrics.zeroDate !== null && (
                <p className="text-xs text-muted-foreground">
                  Until {runwayMetrics.zeroDate.toLocaleDateString()}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Minimum Balance</CardTitle>
              <TrendingDown className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-bold ${runwayMetrics.minimumBalance < 0 ? 'text-destructive' : 'text-foreground'}`}
              >
                {formatCurrency(runwayMetrics.minimumBalance)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Manual Scenario</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              These inputs are independent of your ledger forecast.
            </p>
            <div>
              <label htmlFor={initialBalanceId}>Manually entered starting balance ($)</label>
              <Input
                type="number"
                id={initialBalanceId}
                value={initialBalance}
                onChange={(e) => handleInputChange('initialBalance', Number(e.target.value))}
              />
            </div>
            <div>
              <label htmlFor={monthlyExpensesId}>Manually entered monthly expenses ($)</label>
              <Input
                type="number"
                id={monthlyExpensesId}
                value={monthlyExpenses}
                onChange={(e) => handleInputChange('monthlyExpenses', Number(e.target.value))}
              />
            </div>
            <Button
              onClick={handleCalculateRunway}
              disabled={initialBalance < 0 || monthlyExpenses < 0 || runwayMutation.isPending}
            >
              {runwayMutation.isPending ? 'Calculating...' : 'Calculate Runway'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add Planned Purchase</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label htmlFor={descriptionId}>Description</label>
                <Input
                  id={descriptionId}
                  placeholder="e.g., New laptop"
                  value={newPurchase.description}
                  onChange={(e) => setNewPurchase({ ...newPurchase, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor={amountId}>Amount ($)</label>
                  <Input
                    type="number"
                    id={amountId}
                    placeholder="0"
                    value={newPurchase.amount}
                    onChange={(e) =>
                      setNewPurchase({ ...newPurchase, amount: Number(e.target.value) })
                    }
                  />
                </div>
                <div>
                  <label htmlFor={dateId}>Date</label>
                  <Input
                    type="date"
                    id={dateId}
                    value={newPurchase.date}
                    onChange={(e) => setNewPurchase({ ...newPurchase, date: e.target.value })}
                  />
                </div>
              </div>
              <Button
                onClick={handleAddPurchase}
                disabled={!newPurchase.description || newPurchase.amount <= 0 || !newPurchase.date}
              >
                Add Purchase
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {plannedPurchases.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Planned Purchases</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {plannedPurchases.map((purchase, index) => (
                <div
                  key={`${purchase.description}-${purchase.date}-${index}`}
                  className="flex justify-between items-center p-3 border border-border"
                >
                  <div>
                    <span className="font-medium">{purchase.description}</span>
                    <span className="text-sm text-muted-foreground ml-2">
                      on {new Date(purchase.date).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{formatCurrency(purchase.amount)}</span>
                    <Button variant="outline" size="sm" onClick={() => handleRemovePurchase(index)}>
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
              <div className="pt-2 border-t">
                <div className="flex justify-between items-center font-semibold">
                  <span>Total Planned Expenses:</span>
                  <span>{formatCurrency(runwayMetrics.totalPlannedExpenses)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>12-Month Scenario Projection</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-100">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(value) => formatCurrency(value)} />
                  <Tooltip
                    formatter={(value) => [formatCurrency(Number(value)), 'Projected Balance']}
                    labelStyle={{ color: CHART_COLORS.neutral }}
                    contentStyle={{
                      backgroundColor: CHART_COLORS.tooltip.background,
                      border: `1px solid ${CHART_COLORS.tooltip.border}`,
                      borderRadius: '6px',
                    }}
                  />
                  <ReferenceLine y={0} stroke={CHART_COLORS.negative} strokeDasharray="2 2" />
                  <Line
                    type="monotone"
                    dataKey="balance"
                    stroke={CHART_COLORS.positive}
                    strokeWidth={2}
                    dot={(props) => {
                      const { cx, cy, payload } = props;
                      const isNegative = payload?.balance < 0;
                      return (
                        <circle
                          cx={cx}
                          cy={cy}
                          r={4}
                          fill={isNegative ? CHART_COLORS.negative : CHART_COLORS.positive}
                          stroke={isNegative ? CHART_COLORS.negative : CHART_COLORS.positive}
                          strokeWidth={2}
                        />
                      );
                    }}
                    activeDot={{ r: 6, stroke: CHART_COLORS.positive, strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
