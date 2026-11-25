import {
  computeLedgerRunway,
  getRunwaySettings,
  type RunwayBudget,
} from '@hominem/finance-services';
import type { z } from 'zod';

import type { financeRunwayInputSchema } from '../schemas/finance.schema';

export async function getFinanceLedgerRunway(
  ownerUserId: string,
  input?: z.infer<typeof financeRunwayInputSchema>,
) {
  const settings = await getRunwaySettings(ownerUserId);
  let monthlyBudgets: RunwayBudget[] = settings.budgets.map(
    ({ category, amount, currencyCode }) => ({ category, amount, currencyCode }),
  );

  if (input) {
    const overrides = new Map(
      monthlyBudgets
        .filter((budget) => budget.currencyCode === settings.currencyCode)
        .map((budget) => [budget.category.toLowerCase(), budget]),
    );
    for (const budget of input.monthlyBudgets) {
      overrides.set(budget.category.toLowerCase(), {
        category: budget.category,
        amount: budget.amountCents / 100,
        ...(settings.currencyCode ? { currencyCode: settings.currencyCode } : {}),
        ...(budget.note ? { note: budget.note } : {}),
      });
    }
    monthlyBudgets = [...overrides.values()];
  }

  const runway = await computeLedgerRunway({
    userId: ownerUserId,
    currencyCode: settings.currencyCode,
    monthlyBudgets,
    ...(input ? { projectionWeeks: input.projectionWeeks } : {}),
    ...(input?.asOf ? { asOf: input.asOf } : {}),
  });
  return { settings, runway };
}
