import { NotFoundError } from '@hominem/db/errors';
import { getAccountSummaries } from '@hominem/finance-services';

import {
  financeAccountSummaryInputSchema,
  financeAccountSummaryOutputSchema,
} from '../../../../schemas/finance.schema';
import { defineMcpTool } from '../../../tool-registry';

const MAX_SUMMARY_ACCOUNTS = 500;

export const financeAccountSummaryTool = defineMcpTool(
  {
    name: 'finance_account_summary',
    title: 'Finance Account Summary',
    description:
      'Reconcile per account: transaction and excluded counts, per-currency totals, and the posted-on span. ' +
      'Counts and totals cover every row (pending and excluded included), and closed accounts are included by default.',
    inputSchema: financeAccountSummaryInputSchema,
    outputSchema: financeAccountSummaryOutputSchema,
    readOnly: true,
    scopes: ['finance:read'],
    resultCap: MAX_SUMMARY_ACCOUNTS,
    guidance: {
      whenToUse: 'Verifying an import or reconciling account totals without paging transactions.',
      whenNotToUse: 'Do not use for spending breakdowns; use finance_spending_by_category.',
      produces: ['per-account transaction counts', 'per-account totals'],
    },
  },
  async (ownerUserId, input) => {
    const { summaries } = await getAccountSummaries(ownerUserId, {
      ...(input.accountId ? { accountId: input.accountId } : {}),
      includeClosed: input.includeClosed,
    });
    if (input.accountId && summaries.length === 0) throw new NotFoundError('Account');
    const limited = summaries.slice(0, MAX_SUMMARY_ACCOUNTS);
    return {
      accounts: limited.map((summary) => ({
        accountId: summary.accountId,
        accountName: summary.accountName,
        allowedCurrencies: summary.allowedCurrencies,
        status: summary.status,
        transactionCount: summary.transactionCount,
        excludedCount: summary.excludedCount,
        totals: summary.totals.map((total) => ({
          currencyCode: total.currencyCode,
          sum: total.sumAmount,
        })),
        minPostedOn: summary.minPostedOn,
        maxPostedOn: summary.maxPostedOn,
      })),
      count: limited.length,
      totalCount: summaries.length,
    };
  },
);
