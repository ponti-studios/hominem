import { financeAccountsSlice } from './accounts';
import { financeTransactionsSlice } from './transactions';

export const financeSlices = [financeAccountsSlice, financeTransactionsSlice] as const;
