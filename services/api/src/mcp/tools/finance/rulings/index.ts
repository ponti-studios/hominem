import { z } from 'zod';

import {
  importReferenceRulebook,
  listRulingQueue,
} from '../../../../application/finance.rulings.service';
import {
  rulingQueueInputSchema,
  rulingQueueOutputSchema,
  rulingRulebookImportInputSchema,
} from '../../../../schemas/finance.rulings.schema';
import { defineMcpSlice, defineMcpTool } from '../../../tool-registry';

export const financeRulingsSlice = defineMcpSlice({
  name: 'finance.rulings',
  tools: [
    defineMcpTool(
      {
        name: 'finance_rulings_queue',
        title: 'Finance rulings queue',
        description:
          'Read recorded finance verdicts and their frozen transaction state. This does not file transactions.',
        inputSchema: rulingQueueInputSchema,
        outputSchema: rulingQueueOutputSchema,
        readOnly: true,
        scopes: ['finance:read'],
        resultCap: 50,
        guidance: {
          whenToUse: 'Inspect or export recorded finance rulings.',
          whenNotToUse: 'Do not use as a transaction search.',
        },
      },
      (userId, input) => listRulingQueue(userId, input.offset, input.limit),
    ),
    defineMcpTool(
      {
        name: 'finance_rulings_import_reference_rulebook',
        title: 'Import finance reference rulebook',
        description:
          'Import a versioned finance rulebook for transaction category and tag suggestions.',
        inputSchema: rulingRulebookImportInputSchema,
        outputSchema: z.object({ id: z.string(), fingerprint: z.string() }),
        readOnly: false,
        scopes: ['finance:write'],
        resultCap: 1,
        guidance: {
          whenToUse: 'Import a reviewed reference rulebook before preparing transaction rulings.',
          whenNotToUse: 'Do not use to update ledger transactions.',
        },
      },
      (userId, input) => importReferenceRulebook(userId, input),
    ),
  ],
});
