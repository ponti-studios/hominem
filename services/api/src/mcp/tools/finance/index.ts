import { financeAccountsSlice } from './accounts';
import { financeBillsSlice } from './bills';
import { financeBudgetsSlice } from './budgets';
import { financeDoctrineSlice } from './doctrine';
import { financeProviderSlice } from './provider';
import { financeRulingsSlice } from './rulings';
import { financeTransactionsSlice } from './transactions';
import { financeWealthSlice } from './wealth';

export const financeSlices = [
  financeAccountsSlice,
  financeBillsSlice,
  financeBudgetsSlice,
  financeDoctrineSlice,
  financeProviderSlice,
  financeTransactionsSlice,
  financeRulingsSlice,
  financeWealthSlice,
] as const;
