import { isUuid, searchTransactions } from '../../../../application/finance.service';
import {
  financeTransactionSearchInputSchema,
  financeTransactionSearchOutputSchema,
} from '../../../../schemas/finance.schema';
import { defineMcpTool } from '../../../tool-registry';

function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export const financeTransactionSearchTool = defineMcpTool(
  {
    name: 'finance_transaction_search',
    title: 'Finance Transaction Search',
    description:
      'Search transactions by text in the description or merchant name, with optional date range, account and tag filters. ' +
      'Includes pending and excluded transactions (flagged), newest first, and pages with offset.',
    inputSchema: financeTransactionSearchInputSchema,
    outputSchema: financeTransactionSearchOutputSchema,
    readOnly: true,
    scopes: ['finance:read'],
    resultCap: 50,
    guidance: {
      whenToUse: 'The user asks to find specific transactions, e.g. "what did I pay Comcast".',
      whenNotToUse: 'Use finance_recent_transactions for a plain recent-activity list.',
      produces: ['transaction ids', 'transaction amounts', 'merchant names'],
    },
  },
  async (ownerUserId, input) => {
    const result = await searchTransactions(ownerUserId, {
      accountIds: input.accountId ? [input.accountId] : [],
      dateFrom: input.from,
      dateTo: input.to,
      text: input.query,
      ...(input.tag
        ? isUuid(input.tag)
          ? { tagIds: [input.tag] }
          : { tagNames: [input.tag] }
        : {}),
      limit: input.limit,
      offset: input.offset,
      categoryName: input.categoryName,
      transactionType: input.transactionType,
    });
    return {
      transactions: result.data.map((transaction) => ({
        id: transaction.id,
        accountId: transaction.accountId,
        accountName: transaction.accountName,
        postedOn: transaction.postedOn,
        description: transaction.description,
        merchantName: transaction.merchantName,
        amountCents: toCents(transaction.amount),
        currencyCode: transaction.currencyCode,
        transactionType: transaction.transactionType,
        categoryId: transaction.categoryId,
        categoryName: transaction.categoryName,
        tags: transaction.tags,
        notes: transaction.notes,
        orderNumber: transaction.orderNumber,
        counterpartId: transaction.counterpartId,
        source: transaction.source,
        externalId: transaction.externalId,
        recurring: transaction.recurring,
        pending: transaction.pending,
        excluded: transaction.excluded,
      })),
      count: result.data.length,
      filteredCount: result.filteredCount,
      totalUserCount: result.totalUserCount,
    };
  },
);
