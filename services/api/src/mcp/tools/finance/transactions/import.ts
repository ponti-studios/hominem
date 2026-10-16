import { importFinanceTransactions } from '../../../../application/finance.service';
import {
  financeTransactionsImportInputSchema,
  financeTransactionsImportOutputSchema,
} from '../../../../schemas/finance.schema';
import { defineMcpTool } from '../../../tool-registry';

export const financeTransactionsImportTool = defineMcpTool(
  {
    readOnly: false,
    scopes: ['finance:write'],
    destructive: true,
    idempotent: true,
    standaloneWrite: true,
    requiresConfirmation: true,
    name: 'finance_transactions_import',
    title: 'Finance Transactions Import',
    description:
      'Batch upsert for backfill and daily deltas (max 1000 per call). Mode append adds/updates; mode replace wipes the finance store first. dryRun validates without writing. Per-row rejections never fail the batch.',
    inputSchema: financeTransactionsImportInputSchema,
    outputSchema: financeTransactionsImportOutputSchema,
    resultCap: 1000,
    guidance: {
      whenToUse: 'Backfilling sheet history or pushing daily deltas.',
      whenNotToUse: 'Do not use mode replace without explicit confirmation.',
      dependencies: [
        { tool: 'finance_accounts', reason: 'build the sheet-label map', provides: ['id'] },
      ],
    },
    preview: async (_ownerUserId, input) => {
      const parsed = financeTransactionsImportInputSchema.safeParse(input);
      if (!parsed.success) return null;
      const { mode, dryRun, iUnderstand, transactions } = parsed.data;
      if (mode !== 'replace' || dryRun || iUnderstand) return null;
      return { mode: 'replace', count: transactions.length, dryRun };
    },
  },
  async (ownerUserId, input) => ({
    ...(await importFinanceTransactions(ownerUserId, input)),
    dryRun: input.dryRun,
  }),
);
