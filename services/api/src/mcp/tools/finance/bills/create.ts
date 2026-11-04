import { createBill } from '../../../../application/finance-bills.service';
import {
  financeBillCreateInputSchema,
  financeBillCreateOutputSchema,
} from '../../../../schemas/finance.schema';
import { defineMcpTool } from '../../../tool-registry';

export const financeBillCreateTool = defineMcpTool(
  {
    name: 'finance_bill_create',
    title: 'Finance Bill Create',
    description:
      'Register a bill: reference data about a recurring obligation — who it is with, how it is paid, what it should cost. A bill never creates, moves or edits a transaction; last-paid is derived at read time from matched transactions. A top-up bill carries no cadence, a variable bill carries no expected amount, and a one-off bill carries its due date.',
    inputSchema: financeBillCreateInputSchema,
    outputSchema: financeBillCreateOutputSchema,
    readOnly: false,
    scopes: ['finance:write'],
    destructive: false,
    idempotent: false,
    resultCap: 1,
    guidance: {
      whenToUse:
        'The user names a recurring bill to track, e.g. an energy supplier, broadband, or a pay-as-you-go meter to watch.',
      whenNotToUse:
        'Do not use for one-off spending or to record a payment — bills are reference data, and they never move money.',
      produces: ['bill with computed next due date'],
    },
  },
  async (ownerUserId, input) => createBill(ownerUserId, input),
);
