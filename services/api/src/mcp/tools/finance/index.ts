import { financeAccountsSlice } from './accounts';
import { financeBudgetsSlice } from './budgets';
import { financeTransactionsSlice } from './transactions';

export const financeSlices = [
  financeAccountsSlice,
  financeBudgetsSlice,
  financeTransactionsSlice,
] as const;
