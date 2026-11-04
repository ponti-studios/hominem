import { NotFoundError } from '@hominem/db/errors';

import { deleteBill, getBillPreview } from '../../../../application/finance-bills.service';
import {
  financeBillDeleteInputSchema,
  financeBillDeleteOutputSchema,
} from '../../../../schemas/finance.schema';
import { defineMcpTool } from '../../../tool-registry';

export const financeBillDeleteTool = defineMcpTool(
  {
    name: 'finance_bill_delete',
    title: 'Finance Bill Delete',
    description:
      'Delete a bill and its balance log. The bill’s transactions are untouched — a bill is reference data, not a movement of money. The MCP server asks for confirmation before deletion. Set dryRun to preview the affected bill and its entry count without writing or requesting confirmation.',
    inputSchema: financeBillDeleteInputSchema,
    outputSchema: financeBillDeleteOutputSchema,
    readOnly: false,
    scopes: ['finance:write'],
    destructive: true,
    idempotent: true,
    requiresConfirmation: true,
    resultCap: 1,
    guidance: {
      whenToUse: 'The user no longer wants to track that bill.',
      whenNotToUse: 'Do not delete a bill to pause it; update its status instead.',
      dependencies: [
        { tool: 'finance_bill_list', reason: 'resolve the bill id', provides: ['id'] },
      ],
    },
    preview: async (ownerUserId, input) => {
      const parsed = financeBillDeleteInputSchema.safeParse(input);
      if (!parsed.success) return null;
      const bill = await getBillPreview(ownerUserId, parsed.data.billId);
      return bill ? { name: bill.name, balanceEntryCount: bill.balanceEntryCount } : null;
    },
  },
  async (ownerUserId, input) => {
    const result = await deleteBill(ownerUserId, input.billId, { dryRun: input.dryRun });
    if (input.dryRun ? result.preview.length === 0 : !result.removed) {
      throw new NotFoundError('Finance bill', { reason: 'not_found' });
    }
    return result;
  },
);
