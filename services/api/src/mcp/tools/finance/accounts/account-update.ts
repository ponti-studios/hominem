import { applyAccountUpdate } from '@hominem/finance-services';

import {
  financeAccountUpdateInputSchema,
  financeAccountUpdateOutputSchema,
} from '../../../../schemas/finance.schema';
import { defineMcpTool } from '../../../tool-registry';

const MAX_ACCOUNT_CURRENCIES = 500;

export const financeAccountUpdateTool = defineMcpTool(
  {
    name: 'finance_account_update',
    title: 'Finance Account Update',
    description:
      'Partially update an account addressed by id: name, institution, accountNumber (mask), accountType, status, allowedCurrencies and includeInNetWorth. Omitted fields are unchanged; null clears institution/accountNumber. Identity — id, transactions, links — never changes, and currencyCode is immutable here. includeInNetWorth is independent of status. dryRun projects the change set without applying it.',
    inputSchema: financeAccountUpdateInputSchema,
    outputSchema: financeAccountUpdateOutputSchema,
    readOnly: false,
    scopes: ['finance:write'],
    destructive: false,
    idempotent: true,
    standaloneWrite: true,
    resultCap: MAX_ACCOUNT_CURRENCIES,
    guidance: {
      whenToUse:
        'Correcting account metadata or changing the currencies allowed for its transactions.',
      whenNotToUse:
        'Do not use to change an account currency (immutable) or to delete/merge accounts (out of scope).',
      dependencies: [
        { tool: 'finance_accounts', reason: 'resolve the account id', provides: ['id'] },
      ],
    },
  },
  async (ownerUserId, input) => {
    const result = await applyAccountUpdate(
      ownerUserId,
      input.accountId,
      {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.institution !== undefined ? { institution: input.institution } : {}),
        ...(input.accountNumber !== undefined ? { mask: input.accountNumber } : {}),
        ...(input.accountType !== undefined ? { accountType: input.accountType } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.currencyCode !== undefined ? { currencyCode: input.currencyCode } : {}),
        ...(input.allowedCurrencies !== undefined
          ? { allowedCurrencies: input.allowedCurrencies }
          : {}),
        ...(input.includeInNetWorth !== undefined
          ? { includeInNetWorth: input.includeInNetWorth }
          : {}),
      },
      { dryRun: input.dryRun },
    );
    return { ...result, dryRun: input.dryRun };
  },
);
