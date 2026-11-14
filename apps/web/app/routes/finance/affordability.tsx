import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from '@ponti-studios/ui/forms';
import { Button } from '@ponti-studios/ui/primitives';
import { Card, CardContent, CardHeader, CardTitle } from '@ponti-studios/ui/primitives';
import { useState, type FormEvent } from 'react';

import { CurrencyField, PageHeader } from '~/components/design';
import {
  useAffordabilityContext,
  useCheckAffordability,
  useSaveAffordabilityCurrency,
} from '~/modules/finance/hooks/use-affordability';

function formatCurrency(amount: number, currencyCode: string): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: currencyCode }).format(
    amount,
  );
}

function formatInputValue(value: number | null): string {
  return value === null ? '' : String(value);
}

function parseAmount(value: string, allowNegative = false): number | null {
  if (value.trim() === '') return null;
  const amount = Number(value);
  return Number.isFinite(amount) && (allowNegative || amount >= 0) ? amount : null;
}

export default function AffordabilityPage() {
  const contextQuery = useAffordabilityContext();
  const saveCurrency = useSaveAffordabilityCurrency();
  const affordabilityMutation = useCheckAffordability();
  const [purchaseAmount, setPurchaseAmount] = useState('');
  const [cashBalanceOverride, setCashBalanceOverride] = useState('');
  const [monthlyIncomeInput, setMonthlyIncomeInput] = useState<string | null>(null);
  const [monthlyExpensesInput, setMonthlyExpensesInput] = useState<string | null>(null);
  const [reserveTargetInput, setReserveTargetInput] = useState<string | null>(null);
  const [reserveEnabled, setReserveEnabled] = useState(true);

  const context = contextQuery.data;
  const currencyCode = context?.currencyCode ?? null;
  const monthlyIncome =
    monthlyIncomeInput === null
      ? (context?.monthlyIncome ?? null)
      : parseAmount(monthlyIncomeInput);
  const monthlyExpenses =
    monthlyExpensesInput === null
      ? (context?.monthlyExpenses ?? null)
      : parseAmount(monthlyExpensesInput);
  const currentBalance =
    context?.startingCash === null ? parseAmount(cashBalanceOverride, true) : context?.startingCash;
  const purchase = parseAmount(purchaseAmount);
  const defaultReserveTarget = monthlyExpenses === null ? null : monthlyExpenses * 3;
  const reserveTarget =
    reserveTargetInput === null ? defaultReserveTarget : parseAmount(reserveTargetInput);
  const canCheck =
    Boolean(currencyCode) &&
    purchase !== null &&
    purchase > 0 &&
    currentBalance !== null &&
    monthlyIncome !== null &&
    monthlyExpenses !== null &&
    (!reserveEnabled || reserveTarget !== null) &&
    !contextQuery.isLoading &&
    !saveCurrency.isPending &&
    !affordabilityMutation.isPending;

  function clearResult() {
    affordabilityMutation.reset();
  }

  function handleCheck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canCheck || !context?.currencyCode || purchase === null) return;

    affordabilityMutation.mutate({
      purchaseAmount: purchase,
      ...(context.startingCash === null && currentBalance !== null
        ? { cashBalanceOverride: currentBalance }
        : {}),
      ...(monthlyIncomeInput !== null && monthlyIncome !== null
        ? { monthlyIncomeOverride: monthlyIncome }
        : {}),
      ...(monthlyExpensesInput !== null && monthlyExpenses !== null
        ? { monthlyExpensesOverride: monthlyExpenses }
        : {}),
      ...(reserveEnabled
        ? reserveTargetInput === null
          ? {}
          : { reserveTarget }
        : { reserveTarget: null }),
    });
  }

  const result = affordabilityMutation.data;
  const currencyFractionDigits = currencyCode
    ? (new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: currencyCode,
      }).resolvedOptions().maximumFractionDigits ?? 2)
    : 2;
  const amountStep = 10 ** -currencyFractionDigits;

  return (
    <div className="space-y-6">
      <PageHeader title="Can I afford this?" />

      {contextQuery.isLoading ? (
        <p role="status" className="text-sm text-muted-foreground">
          Loading your Finance data…
        </p>
      ) : contextQuery.isError ? (
        <div role="alert" className="space-y-3 rounded-sm border p-4 text-sm">
          <p>{contextQuery.error.message || 'Unable to load Finance data.'}</p>
          <Button type="button" variant="outline" onClick={() => contextQuery.refetch()}>
            Try again
          </Button>
        </div>
      ) : context ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Your numbers</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-5 text-sm text-muted-foreground">
                Estimate how a one-time cash purchase changes your available cash and reserve.
                Values are temporary and this scenario is not saved.
              </p>

              {!currencyCode ? (
                <div className="mb-5 max-w-sm space-y-2">
                  <label htmlFor="affordability-currency">Finance currency</label>
                  <Select
                    name="currencyCode"
                    value=""
                    disabled={saveCurrency.isPending || context.availableCurrencies.length === 0}
                    onValueChange={(value) => {
                      if (value === null) return;
                      clearResult();
                      saveCurrency.mutate(
                        { currencyCode: value },
                        {
                          onSuccess: () => {
                            setMonthlyIncomeInput(null);
                            setMonthlyExpensesInput(null);
                            setCashBalanceOverride('');
                          },
                        },
                      );
                    }}
                  >
                    <SelectTrigger id="affordability-currency">
                      <SelectValue placeholder="Choose currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {context.availableCurrencies.map((currency) => (
                        <SelectItem key={currency} value={currency}>
                          {currency}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {context.availableCurrencies.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Add a cash, checking, savings, or depository account in Finance first.
                    </p>
                  )}
                </div>
              ) : (
                <p className="mb-5 text-sm text-muted-foreground">
                  Finance currency:{' '}
                  <span className="font-medium text-foreground">{currencyCode}</span>
                  {' · '}History: {context.historyStartDate} to {context.historyEndDate} (6 complete
                  months)
                </p>
              )}

              {context.warnings.map((warning) => (
                <p key={warning} className="mb-3 text-sm text-muted-foreground">
                  {warning}
                </p>
              ))}
              {saveCurrency.isError && (
                <p role="alert" className="mb-3 text-sm text-destructive">
                  {saveCurrency.error.message}
                </p>
              )}

              <form onSubmit={handleCheck} className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <CurrencyField
                    label="Purchase amount"
                    name="purchaseAmount"
                    currency={currencyCode ?? undefined}
                    min={0.01}
                    step={amountStep}
                    required
                    value={purchaseAmount}
                    onChange={(event) => {
                      clearResult();
                      setPurchaseAmount(event.target.value);
                    }}
                  />

                  <CurrencyField
                    label="Available cash"
                    name="availableCash"
                    currency={currencyCode ?? undefined}
                    step={context.startingCash === null ? amountStep : undefined}
                    required={context.startingCash === null}
                    readOnly={context.startingCash !== null}
                    value={
                      context.startingCash === null
                        ? cashBalanceOverride
                        : new Intl.NumberFormat(undefined, {
                            minimumFractionDigits: currencyFractionDigits,
                            maximumFractionDigits: currencyFractionDigits,
                          }).format(context.startingCash)
                    }
                    onChange={(event) => {
                      clearResult();
                      setCashBalanceOverride(event.target.value);
                    }}
                  />

                  <CurrencyField
                    label="Average monthly income"
                    name="monthlyIncome"
                    currency={currencyCode ?? undefined}
                    min={0}
                    step={amountStep}
                    required
                    value={monthlyIncomeInput ?? formatInputValue(context.monthlyIncome)}
                    hint={
                      context.monthlyIncome === null
                        ? 'No history found. Enter a monthly amount to continue.'
                        : monthlyIncomeInput === null
                          ? 'Prefilled from posted transactions; edit for this check only.'
                          : 'Temporary assumption for this check.'
                    }
                    onChange={(event) => {
                      clearResult();
                      setMonthlyIncomeInput(event.target.value);
                    }}
                  />

                  <CurrencyField
                    label="Average monthly expenses"
                    name="monthlyExpenses"
                    currency={currencyCode ?? undefined}
                    min={0}
                    step={amountStep}
                    required
                    value={monthlyExpensesInput ?? formatInputValue(context.monthlyExpenses)}
                    hint={
                      context.monthlyExpenses === null
                        ? 'No history found. Enter a monthly amount to continue.'
                        : monthlyExpensesInput === null
                          ? 'Prefilled from posted transactions; edit for this check only.'
                          : 'Temporary assumption for this check.'
                    }
                    onChange={(event) => {
                      clearResult();
                      setMonthlyExpensesInput(event.target.value);
                    }}
                  />
                </div>

                <div className="max-w-sm space-y-2">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="include-reserve"
                      checked={reserveEnabled}
                      onCheckedChange={(checked) => {
                        clearResult();
                        setReserveEnabled(checked);
                      }}
                    />
                    <label htmlFor="include-reserve">Keep a cash reserve</label>
                  </div>
                  {reserveEnabled && (
                    <>
                      <CurrencyField
                        label="Reserve target"
                        name="reserveTarget"
                        currency={currencyCode ?? undefined}
                        min={0}
                        step={amountStep}
                        required
                        value={reserveTargetInput ?? formatInputValue(defaultReserveTarget)}
                        hint="Defaults to three months of the monthly expenses above."
                        onChange={(event) => {
                          clearResult();
                          setReserveTargetInput(event.target.value);
                        }}
                      />
                    </>
                  )}
                </div>

                {affordabilityMutation.isError && (
                  <p role="alert" className="text-sm text-destructive">
                    {affordabilityMutation.error.message || 'Unable to check this purchase.'}
                  </p>
                )}
                <Button type="submit" disabled={!canCheck}>
                  {affordabilityMutation.isPending ? 'Checking…' : 'Check purchase impact'}
                </Button>
                {!canCheck && currencyCode && (
                  <p className="text-xs text-muted-foreground">
                    Enter a purchase amount and complete any missing Finance values to continue.
                  </p>
                )}
              </form>
            </CardContent>
          </Card>

          {result && (
            <Card aria-live="polite">
              <CardHeader>
                <CardTitle>Purchase impact</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="divide-y">
                  <div className="flex items-baseline justify-between gap-4 py-3">
                    <dt>Cash after purchase</dt>
                    <dd className="font-semibold">
                      {formatCurrency(result.balanceAfterPurchase, result.currencyCode)}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-4 py-3">
                    <dt>Cash reserve target</dt>
                    <dd>
                      {result.reserveTarget === null
                        ? 'Off'
                        : formatCurrency(result.reserveTarget, result.currencyCode)}
                    </dd>
                  </div>
                  {result.reserveShortfall !== null && (
                    <div className="flex items-baseline justify-between gap-4 py-3">
                      <dt>Below reserve target</dt>
                      <dd>{formatCurrency(result.reserveShortfall, result.currencyCode)}</dd>
                    </div>
                  )}
                  <div className="flex items-baseline justify-between gap-4 py-3">
                    <dt>Monthly cash flow</dt>
                    <dd>
                      {formatCurrency(result.monthlySurplus, result.currencyCode)}{' '}
                      {result.monthlySurplus >= 0 ? 'surplus' : 'deficit'}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-4 py-3">
                    <dt>Months until cash depletion</dt>
                    <dd>
                      {result.monthsUntilDepletion === null
                        ? 'No projected depletion at this cash flow'
                        : `${result.monthsUntilDepletion.toFixed(1)} months`}
                    </dd>
                  </div>
                </dl>
                <p className="mt-3 text-sm text-muted-foreground">{result.explanation}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Based on {result.historyStartDate} to {result.historyEndDate}; cash balance:{' '}
                  {result.balanceSource}, monthly income: {result.monthlyIncomeSource}, monthly
                  expenses: {result.monthlyExpensesSource}. This temporary cash-purchase scenario is
                  not saved.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}
