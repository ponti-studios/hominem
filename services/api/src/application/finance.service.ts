import { FinanceQueryRepository } from '@hominem/db';
import type { z } from 'zod';

import {
  financeMonthlySummarySchema,
  type FinanceMonthlySummaryQuery,
} from '../schemas/finance.schema';

export type FinanceMonthlySummaryDto = z.infer<typeof financeMonthlySummarySchema>;

export class FinanceService {
  async monthlySummary(
    ownerUserId: string,
    input: FinanceMonthlySummaryQuery,
  ): Promise<FinanceMonthlySummaryDto> {
    const summary = await FinanceQueryRepository.monthlySummary(ownerUserId, input);
    return financeMonthlySummarySchema.parse(summary);
  }
}
