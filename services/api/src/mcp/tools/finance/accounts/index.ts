import { defineMcpSlice } from '../../../tool-registry';
import { financeAccountCreateTool } from './account-create';
import { financeAccountDeleteTool } from './account-delete';
import { financeAccountSummaryTool } from './account-summary';
import { financeAccountUpdateTool } from './account-update';
import { financeAccountsTool } from './accounts';

export const financeAccountsSlice = defineMcpSlice({
  name: 'finance.accounts',
  tools: [
    financeAccountsTool,
    financeAccountSummaryTool,
    financeAccountCreateTool,
    financeAccountDeleteTool,
    financeAccountUpdateTool,
  ],
});
