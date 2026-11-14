import { financeAccountsSlice } from './accounts';
import { financeBillsSlice } from './bills';
import { financeBudgetsSlice } from './budgets';
import { financeRulingsSlice } from './rulings';
import { financeTransactionsSlice } from './transactions';

export const financeSlices = [
  financeAccountsSlice,
  financeBillsSlice,
  financeBudgetsSlice,
  financeTransactionsSlice,
  financeRulingsSlice,
] as const;
