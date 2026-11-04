import { logBillBalance } from '../../../../application/finance-bills.service';
import {
  financeBillLogBalanceInputSchema,
  financeBillLogBalanceOutputSchema,
} from '../../../../schemas/finance.schema';
import { defineMcpTool } from '../../../tool-registry';

export const financeBillLogBalanceTool = defineMcpTool(
  {
    name: 'finance_bill_log_balance',
    title: 'Finance Bill Log Balance',
    description:
      'Log a balance observation on a top-up bill: the supplier balance as of the checked time, plus the meter reading, supply status and where the observation came from. The log is append-only — corrections are new rows, never edits. Returns the entry and the bill with its updated pay-as-you-go derivation.',
    inputSchema: financeBillLogBalanceInputSchema,
    outputSchema: financeBillLogBalanceOutputSchema,
    readOnly: false,
    scopes: ['finance:write'],
    destructive: false,
    idempotent: false,
    resultCap: 10,
    guidance: {
      whenToUse:
        'An agent read a pay-as-you-go balance from the supplier portal (or the user reported one) and the observation needs recording.',
      whenNotToUse:
        'Do not use on bills that are not top-up, and do not edit a past entry — log the correction as a new row.',
      dependencies: [
        { tool: 'finance_bill_list', reason: 'resolve the bill id', provides: ['id'] },
      ],
      produces: ['balance entry', 'updated pay-as-you-go status'],
    },
  },
  async (ownerUserId, input) => {
    const { billId, ...entry } = input;
    return logBillBalance(ownerUserId, billId, entry);
  },
);
