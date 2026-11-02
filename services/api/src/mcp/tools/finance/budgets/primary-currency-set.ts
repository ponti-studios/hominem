import { setPrimaryCurrency } from '../../../../application/finance-budgets.service';
import {
  financePrimaryCurrencySetInputSchema,
  financePrimaryCurrencySetOutputSchema,
} from '../../../../schemas/finance.schema';
import { defineMcpTool } from '../../../tool-registry';

export const financePrimaryCurrencySetTool = defineMcpTool(
  {
    name: 'finance_primary_currency_set',
    title: 'Finance Primary Currency Set',
    description:
      'Set the profile primary currency (ISO 4217) that budgets are denominated in. This is an explicit user action: creating a budget never changes it. Existing budgets re-denominate immediately, counting each foreign transaction at its settled amount in the new currency where the record carries one.',
    inputSchema: financePrimaryCurrencySetInputSchema,
    outputSchema: financePrimaryCurrencySetOutputSchema,
    readOnly: false,
    scopes: ['finance:write'],
    destructive: false,
    idempotent: true,
    standaloneWrite: true,
    resultCap: 1,
    guidance: {
      whenToUse:
        'The user explicitly states the currency they think in, or a budget tool reports that the primary currency is not set.',
      whenNotToUse:
        'Do not change it as a side effect of creating a budget or recording a transaction, and do not guess a currency from account names.',
      produces: ['primaryCurrency'],
    },
  },
  async (ownerUserId, input) => setPrimaryCurrency(ownerUserId, input.currencyCode),
);
