import { listBills } from '../../../../application/finance-bills.service';
import {
  financeBillListInputSchema,
  financeBillListOutputSchema,
} from '../../../../schemas/finance.schema';
import { defineMcpTool } from '../../../tool-registry';

export const financeBillListTool = defineMcpTool(
  {
    name: 'finance_bill_list',
    title: 'Finance Bill List',
    description:
      'List the caller’s bills with their computed state: the next due date (from the cadence and due day, never stored), the latest matched transaction, and the pay-as-you-go derivation on top-up bills. Optionally filter by status, lifecycle type, or kind.',
    inputSchema: financeBillListInputSchema,
    outputSchema: financeBillListOutputSchema,
    readOnly: true,
    scopes: ['finance:read'],
    resultCap: 50,
    guidance: {
      whenToUse:
        'The user asks what bills exist, what is due next, or how a pay-as-you-go balance is doing.',
      whenNotToUse: 'Do not use for transaction history or spending reports.',
      produces: ['bills with next due dates', 'last-paid transactions', 'pay-as-you-go status'],
    },
  },
  async (ownerUserId, input) => listBills(ownerUserId, input),
);
