import { financeSync } from '../../../../application/finance.sync.service';
import {
  financeSyncInputSchema,
  financeSyncOutputSchema,
} from '../../../../schemas/finance.sync.schema';
import { defineMcpTool } from '../../../tool-registry';

export const financeSyncTool = defineMcpTool(
  {
    name: 'finance_sync',
    title: 'Sync finance transactions',
    description:
      'Route and classify settled Starling and Plaid transactions using the authenticated owner’s accounts and doctrine, then append them without overwriting existing annotations. Unmatched accounts are held and rejected rows are reported.',
    inputSchema: financeSyncInputSchema,
    outputSchema: financeSyncOutputSchema,
    readOnly: false,
    scopes: ['finance:read', 'finance:write'],
    destructive: false,
    idempotent: true,
    standaloneWrite: true,
    resultCap: 1000,
    guidance: {
      whenToUse:
        'Import settled provider feed data using the owner’s configured accounts and doctrine.',
      whenNotToUse: 'Do not send provider credentials; the tool accepts transaction data only.',
    },
  },
  (userId, input) => financeSync(userId, input),
);
