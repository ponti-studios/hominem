import { createOrGetAccount } from '@hominem/finance-services';

import {
  financeAccountCreateInputSchema,
  financeAccountCreateOutputSchema,
} from '../../../../schemas/finance.schema';
import { defineMcpTool } from '../../../tool-registry';

const MAX_ACCOUNT_CURRENCIES = 500;

export const financeAccountCreateTool = defineMcpTool(
  {
    name: 'finance_account_create',
    title: 'Finance Account Create',
    description:
      'Create a finance account, or return the existing one when the name matches case-insensitively (created: false). ' +
      'Accounts created here are what sheet imports resolve against; the import never auto-creates an unknown account. ' +
      'dryRun reports the outcome without writing.',
    inputSchema: financeAccountCreateInputSchema,
    outputSchema: financeAccountCreateOutputSchema,
    readOnly: false,
    scopes: ['finance:write'],
    destructive: false,
    idempotent: true,
    standaloneWrite: true,
    resultCap: MAX_ACCOUNT_CURRENCIES,
    guidance: {
      whenToUse: 'A sheet label or sync source needs an account that does not exist yet.',
      whenNotToUse: 'Do not use to rename, close, or merge an existing account.',
      produces: ['account ids', 'account names'],
    },
  },
  async (ownerUserId, input) => ({
    ...(await createOrGetAccount({
      userId: ownerUserId,
      name: input.name,
      currencyCode: input.currencyCode,
      allowedCurrencies: input.allowedCurrencies,
      ...(input.institution ? { institution: input.institution } : {}),
      ...(input.accountNumber ? { mask: input.accountNumber } : {}),
      status: input.status,
      accountType: input.accountType,
      dryRun: input.dryRun,
    })),
    dryRun: input.dryRun,
  }),
);
