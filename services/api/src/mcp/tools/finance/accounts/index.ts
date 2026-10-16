import { defineMcpSlice } from '../../../tool-registry';
import { financeAccountCreateTool } from './account-create';
import { financeAccountSummaryTool } from './account-summary';
import { financeAccountUpdateTool } from './account-update';
import { financeAccountsTool } from './accounts';

export const financeAccountsSlice = defineMcpSlice({
  name: 'finance.accounts',
  tools: [
    financeAccountsTool,
    financeAccountSummaryTool,
    financeAccountCreateTool,
    financeAccountUpdateTool,
  ],
});
