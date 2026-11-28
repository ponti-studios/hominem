// Plain input rows for the pure (no database) finance cases.
import type { ParsedRow } from '../import/types';
import type { RulingTransaction } from '../rulings';
import type { SheetTransactionInput } from '../sheet-import';

export function sheetRow(description: string, postedOn = '2026-10-01'): SheetTransactionInput {
  return {
    postedOn,
    account: 'Sheet Checking',
    description,
    amountCents: -100,
    currencyCode: 'USD',
  };
}

export function parsedRow(line: number, overrides: Partial<ParsedRow> = {}): ParsedRow {
  return {
    line,
    date: '2026-03-05',
    name: 'Blue Bottle',
    amount: '42.50',
    status: 'posted',
    category: null,
    parentCategory: null,
    excluded: false,
    tags: [],
    type: 'regular',
    account: 'Checking',
    accountMask: null,
    note: null,
    recurring: null,
    raw: {},
    ...overrides,
  };
}

export function rulingTransaction(description: string, id: string): RulingTransaction {
  return {
    id,
    externalId: id,
    description,
    postedOn: '2026-10-01',
    amountCents: -100,
    currencyCode: 'GBP',
    excluded: false,
  };
}

export function filedRulingTransaction(
  description: string,
  id: string,
  categoryName: string,
  tags: string[],
): RulingTransaction {
  return {
    ...rulingTransaction(description, id),
    before: {
      accountId: 'account-1',
      accountName: 'Checking',
      categoryId: 'category-1',
      categoryName,
      tags,
      source: 'bank',
      pending: false,
    },
  };
}
