import { financeAccountsSlice } from './accounts';
import { financeBillsSlice } from './bills';
import { financeBudgetsSlice } from './budgets';
import { financeTransactionsSlice } from './transactions';

export const financeSlices = [
  financeAccountsSlice,
  financeBillsSlice,
  financeBudgetsSlice,
  financeTransactionsSlice,
] as const;
