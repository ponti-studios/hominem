import { financeAccountsSlice } from './accounts';
import { financeBillsSlice } from './bills';
import { financeBudgetsSlice } from './budgets';
import { financeDoctrineSlice } from './doctrine';
import { financeRulingsSlice } from './rulings';
import { financeTransactionsSlice } from './transactions';

export const financeSlices = [
  financeAccountsSlice,
  financeBillsSlice,
  financeBudgetsSlice,
  financeDoctrineSlice,
  financeTransactionsSlice,
  financeRulingsSlice,
] as const;
