import { type McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';

import { canUseTool, type McpRequestScope } from '../resources';
import { buildFinanceReviewPromptText } from './finance-review-content';
import { userPrompt } from './types';

export function registerFinanceReviewPrompt(mcpServer: McpServer, scope: McpRequestScope): void {
  if (!canUseTool(scope, 'finance_monthly_stats')) return;

  mcpServer.registerPrompt(
    'monthly_finance_review',
    {
      title: 'Monthly finance review',
      description:
        'Review one calendar month of income, spending categories and top merchants without changing finance data.',
      argsSchema: z.object({
        month: z
          .string()
          .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Enter a month as YYYY-MM.')
          .optional(),
      }),
    },
    ({ month }) => userPrompt('Monthly finance review', buildFinanceReviewPromptText(month)),
  );
}
