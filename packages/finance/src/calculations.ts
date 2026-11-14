import { z } from 'zod';

export interface LoanDetails {
  monthlyPayment: number;
  totalPayment: number;
  totalInterest: number;
  amortizationSchedule: Array<{
    month: number;
    payment: number;
    principal: number;
    interest: number;
    balance: number;
  }>;
}

export const runwayCalculationSchema = z.object({
  monthlyIncome: z.number().nonnegative(),
  monthlyExpenses: z.number().nonnegative(),
  cashReserve: z.number().nonnegative(),
});

export const calculateBudgetBreakdownInputSchema = z.object({
  monthlyIncome: z.number().nonnegative(),
  savingsTarget: z.number().nonnegative().optional(),
});

export const calculateSavingsGoalInputSchema = z.object({
  currentSavings: z.number().nonnegative(),
  goalAmount: z.number().nonnegative(),
  monthlyContribution: z.number().positive(),
  interestRate: z.number().nonnegative().optional(),
});

export const calculateBudgetSchema = z.object({
  monthlyIncome: z.number().nonnegative(),
  savingsTarget: z.number().nonnegative().optional(),
});

export const loanDetailsInputSchema = z.object({
  principal: z.number().positive(),
  annualRate: z.number().nonnegative(),
  months: z.number().int().positive(),
});

export function calculateBudgetBreakdown(
  input: z.infer<typeof calculateBudgetBreakdownInputSchema>,
): {
  needs: number;
  wants: number;
  savings: number;
  unallocated: number;
} {
  const { monthlyIncome: income, savingsTarget = income * 0.2 } = input;

  const needs = income * 0.5;
  const wants = income * 0.3;
  const savings = Math.min(savingsTarget, income * 0.2);
  const unallocated = Math.max(0, income - needs - wants - savings);

  return {
    needs,
    wants,
    savings,
    unallocated,
  };
}

export function calculateSavingsGoal(input: z.infer<typeof calculateSavingsGoalInputSchema>): {
  months: number;
  interestEarned: number;
  totalContributions: number;
  finalAmount: number;
} {
  const rate = (input.interestRate ?? 0) / 12 / 100;
  const monthlyContribution = input.monthlyContribution;
  let balance = input.currentSavings;
  let months = 0;

  while (balance < input.goalAmount) {
    balance = balance * (1 + rate) + monthlyContribution;
    months += 1;
    if (months > 1200) break;
  }

  const totalContributions = input.currentSavings + monthlyContribution * months;
  const interestEarned = balance - totalContributions;

  return {
    months,
    interestEarned,
    totalContributions,
    finalAmount: balance,
  };
}

export function calculateLoanDetails(input: z.infer<typeof loanDetailsInputSchema>): {
  monthlyPayment: number;
  totalPayment: number;
  totalInterest: number;
  amortizationSchedule: Array<{
    month: number;
    payment: number;
    principal: number;
    interest: number;
    balance: number;
  }>;
} {
  const { principal, annualRate, months } = input;
  const r = annualRate / 100 / 12;

  let monthlyPayment: number;
  if (r === 0) {
    monthlyPayment = principal / months;
  } else {
    const factor = (1 + r) ** months;
    monthlyPayment = (principal * r * factor) / (factor - 1);
  }

  const amortizationSchedule: Array<{
    month: number;
    payment: number;
    principal: number;
    interest: number;
    balance: number;
  }> = [];
  let balance = principal;

  for (let month = 1; month <= months; month++) {
    const interest = balance * r;
    const principalPaid = monthlyPayment - interest;
    balance = Math.max(0, balance - principalPaid);

    amortizationSchedule.push({
      month,
      payment: monthlyPayment,
      principal: principalPaid,
      interest,
      balance,
    });
  }

  const totalPayment = monthlyPayment * months;
  return {
    monthlyPayment,
    totalPayment,
    totalInterest: totalPayment - principal,
    amortizationSchedule,
  };
}

export function calculateRunway(input: z.infer<typeof runwayCalculationSchema>): {
  months: number;
} {
  const net = input.monthlyExpenses - input.monthlyIncome;
  if (net <= 0) {
    return { months: Number.POSITIVE_INFINITY };
  }
  return { months: input.cashReserve / net };
}

export const affordabilityCheckInputSchema = z.object({
  currencyCode: z.string().regex(/^[A-Z]{3}$/),
  purchaseAmount: z.number().finite().positive(),
  currentBalance: z.number().finite(),
  monthlyIncome: z.number().finite().nonnegative(),
  monthlyExpenses: z.number().finite().nonnegative(),
  reserveTarget: z.number().finite().nonnegative().nullable(),
});

function roundAffordabilityAmount(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export function calculateAffordability(input: z.infer<typeof affordabilityCheckInputSchema>): {
  currencyCode: string;
  purchaseAmount: number;
  currentBalance: number;
  balanceAfterPurchase: number;
  reserveTarget: number | null;
  reserveShortfall: number | null;
  monthlySurplus: number;
  monthsUntilDepletion: number | null;
  monthlyIncome: number;
  monthlyExpenses: number;
  explanation: string;
} {
  const {
    purchaseAmount,
    currentBalance,
    monthlyIncome,
    monthlyExpenses,
    reserveTarget,
    currencyCode,
  } = input;

  const balanceAfterPurchase = roundAffordabilityAmount(currentBalance - purchaseAmount);
  const monthlySurplus = roundAffordabilityAmount(monthlyIncome - monthlyExpenses);
  const monthsUntilDepletion =
    balanceAfterPurchase < 0 || (balanceAfterPurchase === 0 && monthlySurplus < 0)
      ? 0
      : monthlySurplus >= 0
        ? null
        : roundAffordabilityAmount(balanceAfterPurchase / -monthlySurplus);
  const reserveShortfall =
    reserveTarget === null
      ? null
      : roundAffordabilityAmount(Math.max(0, reserveTarget - balanceAfterPurchase));
  const explanation =
    reserveTarget === null
      ? 'Reserve comparison is turned off.'
      : reserveShortfall !== null && reserveShortfall > 0
        ? `Remaining cash is below the ${currencyCode} reserve target.`
        : `Remaining cash meets the ${currencyCode} reserve target.`;

  return {
    currencyCode,
    purchaseAmount,
    currentBalance,
    balanceAfterPurchase,
    reserveTarget,
    reserveShortfall,
    monthlySurplus,
    monthsUntilDepletion,
    monthlyIncome,
    monthlyExpenses,
    explanation,
  };
}

export const runwayScenarioInputSchema = z.object({
  balance: z.number().finite().nonnegative(),
  monthlyExpenses: z.number().finite().nonnegative(),
  plannedPurchases: z
    .array(
      z.object({
        description: z.string().trim().min(1),
        amount: z.number().finite().positive(),
        date: z.string().date(),
      }),
    )
    .default([]),
  projectionMonths: z.number().int().positive().max(12).default(12),
  asOf: z.string().date().optional(),
});

export function simulateRunway(input: z.infer<typeof runwayScenarioInputSchema>) {
  const actualAsOf = input.asOf ? new Date(`${input.asOf}T00:00:00.000Z`) : new Date();
  const asOfDate = actualAsOf.toISOString().slice(0, 10);
  const asOf = new Date(Date.UTC(actualAsOf.getUTCFullYear(), actualAsOf.getUTCMonth(), 1));
  const purchases = new Map<number, number>();
  let totalPlannedExpenses = 0;
  for (const purchase of input.plannedPurchases) {
    const date = new Date(`${purchase.date}T00:00:00.000Z`);
    const monthOffset =
      (date.getUTCFullYear() - asOf.getUTCFullYear()) * 12 +
      date.getUTCMonth() -
      asOf.getUTCMonth();
    // Purchases in the current (in-progress) month or outside the 12-month
    // projection window do not belong to any calendar-month bucket, so they
    // neither shift a future balance nor count as planned expenses here.
    if (purchase.date < asOfDate) continue;
    if (monthOffset < 1 || monthOffset > input.projectionMonths) continue;
    const index = monthOffset - 1;
    purchases.set(index, (purchases.get(index) ?? 0) + purchase.amount);
    totalPlannedExpenses += purchase.amount;
  }
  const projectionData: Array<{ month: string; balance: number }> = [];
  let balance = input.balance;
  let monthsToZero: number | null = balance <= 0 ? 0 : null;
  for (let index = 0; index < input.projectionMonths; index++) {
    balance -= input.monthlyExpenses + (purchases.get(index) ?? 0);
    balance = Math.round(balance * 100) / 100;
    const projectedMonth = new Date(
      Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() + index + 1, 1),
    );
    projectionData.push({ month: projectedMonth.toISOString().slice(0, 7), balance });
    if (monthsToZero === null && balance <= 0) monthsToZero = index + 1;
  }
  const runwayEndDate =
    monthsToZero === null
      ? null
      : new Date(
          Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() + monthsToZero, 1),
        ).toISOString();
  return {
    runwayMonths: monthsToZero,
    runwayEndDate,
    isRunwayDangerous: monthsToZero !== null && monthsToZero <= 6,
    totalPlannedExpenses: Math.round(totalPlannedExpenses * 100) / 100,
    projectionData,
    months: monthsToZero,
    years: monthsToZero === null ? null : monthsToZero / 12,
  };
}
