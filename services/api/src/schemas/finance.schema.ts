import * as z from 'zod';

export const financeMonthlySummaryQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  limit: z.coerce.number().int().min(1).max(50).default(25),
});

export const financeMonthlySummarySchema = z.object({
  month: z.string(),
  startsOn: z.string(),
  endsBefore: z.string(),
  currencyCode: z.string(),
  totalSpent: z.number(),
  totalIncome: z.number(),
  transactionCount: z.number().int().nonnegative(),
  topMerchants: z.array(
    z.object({
      merchantName: z.string(),
      totalSpent: z.number(),
      transactionCount: z.number().int().nonnegative(),
    }),
  ),
  transactions: z.array(
    z.object({
      transactionId: z.string().uuid(),
      accountId: z.string().uuid(),
      accountName: z.string(),
      institutionName: z.string().nullable(),
      postedOn: z.string(),
      amount: z.number(),
      transactionType: z.string(),
      merchantName: z.string().nullable(),
    }),
  ),
});

export type FinanceMonthlySummaryQuery = z.infer<typeof financeMonthlySummaryQuerySchema>;
