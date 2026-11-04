import { NotFoundError } from '@hominem/db/errors';

import { updateBill } from '../../../../application/finance-bills.service';
import {
  financeBillUpdateInputSchema,
  financeBillUpdateOutputSchema,
} from '../../../../schemas/finance.schema';
import { defineMcpTool } from '../../../tool-registry';

export const financeBillUpdateTool = defineMcpTool(
  {
    name: 'finance_bill_update',
    title: 'Finance Bill Update',
    description:
      'Update a bill’s reference data, schedule, or detection state: suggested bills confirm or cancel, cancelled is terminal and can never be left, and dismissal lives on the suggested row itself. Schedule rules are validated on the merged row, so a partial update cannot store a half-schedule. Null when the id is not the caller’s bill.',
    inputSchema: financeBillUpdateInputSchema,
    outputSchema: financeBillUpdateOutputSchema,
    readOnly: false,
    scopes: ['finance:write'],
    destructive: false,
    idempotent: true,
    resultCap: 1,
    guidance: {
      whenToUse:
        'The user corrects a bill, confirms or cancels a suggested bill, or pauses or closes one.',
      whenNotToUse: 'Do not use to log a balance observation; that is finance_bill_log_balance.',
      dependencies: [
        { tool: 'finance_bill_list', reason: 'resolve the bill id', provides: ['id'] },
      ],
      produces: ['updated bill'],
    },
  },
  async (ownerUserId, input) => {
    const { billId, ...patch } = input;
    const result = await updateBill(ownerUserId, billId, patch);
    if (!result.bill) throw new NotFoundError('Finance bill', { reason: 'not_found' });
    return result;
  },
);
