import { getBill } from '../../../../application/finance-bills.service';
import {
  financeBillGetInputSchema,
  financeBillGetOutputSchema,
} from '../../../../schemas/finance.schema';
import { defineMcpTool } from '../../../tool-registry';

export const financeBillGetTool = defineMcpTool(
  {
    name: 'finance_bill_get',
    title: 'Finance Bill Get',
    description:
      'Get one bill with its computed state and its recent balance log (most recent first; empty on bills that are not top-up). Null when the id is not the caller’s bill.',
    inputSchema: financeBillGetInputSchema,
    outputSchema: financeBillGetOutputSchema,
    readOnly: true,
    scopes: ['finance:read'],
    resultCap: 10,
    guidance: {
      whenToUse: 'The user asks about one specific bill by the id finance_bill_list returned.',
      whenNotToUse: 'Do not invent a bill id; list bills first.',
      dependencies: [
        { tool: 'finance_bill_list', reason: 'resolve the bill id', provides: ['id'] },
      ],
      produces: ['bill detail', 'next due date', 'pay-as-you-go status', 'recent balance log'],
    },
  },
  async (ownerUserId, input) => getBill(ownerUserId, input.billId),
);
