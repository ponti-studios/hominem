import {
  doctrineGetInputSchema,
  doctrineGetOutputSchema,
  doctrineImportInputSchema,
  doctrineImportOutputSchema,
} from '@hominem/finance-services/finance.doctrine.schema';

import {
  getSyncDoctrine,
  importSyncDoctrine,
} from '../../../../application/finance.doctrine.service';
import { defineMcpSlice, defineMcpTool } from '../../../tool-registry';

// The doctrine's lists are bounded by the schema (5000 entries per list); the
// result envelope itself carries no top-level array, so the cap only guards it.
const MAX_DOCTRINE_RESULT = 5000;

export const financeDoctrineSlice = defineMcpSlice({
  name: 'finance.doctrine',
  tools: [
    defineMcpTool(
      {
        name: 'finance_doctrine_get',
        title: 'Finance sync doctrine',
        description:
          'Read the deterministic ingest doctrine: ordered merchant, tag, amount, transfer and income rules plus category tag lenses, applied by external transaction syncs before import. Categories and tags are names, resolved at import time.',
        inputSchema: doctrineGetInputSchema,
        outputSchema: doctrineGetOutputSchema,
        readOnly: true,
        scopes: ['finance:read'],
        resultCap: MAX_DOCTRINE_RESULT,
        guidance: {
          whenToUse:
            'An external sync needs the current categorization rules, or the user asks what the ingest doctrine is.',
          whenNotToUse:
            'Do not use to categorize by hand or to file ledger transactions; use the finance transactions tools.',
          produces: ['merchant rules', 'tag rules', 'category tag lenses'],
        },
      },
      (userId) => getSyncDoctrine(userId),
    ),
    defineMcpTool(
      {
        name: 'finance_doctrine_import',
        title: 'Import finance sync doctrine',
        description:
          'Replace the ingest doctrine wholesale — full replace, no merge. The fingerprint is computed server-side; importing identical contents is a no-op. dryRun reports the outcome without writing.',
        inputSchema: doctrineImportInputSchema,
        outputSchema: doctrineImportOutputSchema,
        readOnly: false,
        scopes: ['finance:write'],
        destructive: false,
        idempotent: true,
        standaloneWrite: true,
        resultCap: 1,
        guidance: {
          whenToUse:
            'Seeding or revising the deterministic rules an external sync applies at ingest.',
          whenNotToUse:
            'Do not use for ledger merchant suggestions; that is the rulings rulebook, not the sync doctrine.',
        },
      },
      (userId, input) => importSyncDoctrine(userId, input),
    ),
  ],
});
