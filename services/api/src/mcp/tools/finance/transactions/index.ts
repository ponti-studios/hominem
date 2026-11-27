import { defineMcpSlice } from '../../../tool-registry';
import { financeTransactionDeleteTool } from './delete';
import { financeTransactionsImportTool } from './import';
import { financeTransactionMoveTool } from './move';
import { financeRecentTransactionsTool } from './recent';
import { financeTransactionSearchTool } from './search';
import { financeSyncTool } from './sync';
import { financeTransactionUpsertTool } from './upsert';

export const financeTransactionsSlice = defineMcpSlice({
  name: 'finance.transactions',
  tools: [
    financeRecentTransactionsTool,
    financeTransactionSearchTool,
    financeTransactionUpsertTool,
    financeTransactionDeleteTool,
    financeTransactionMoveTool,
    financeTransactionsImportTool,
    financeSyncTool,
  ],
});
