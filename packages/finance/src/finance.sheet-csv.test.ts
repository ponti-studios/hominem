import { describe, expect, it } from 'vitest';

import { parseSheetTransactionsCsv } from './sheet-csv';

const HEADER =
  'date,Bank,Merchant,Amount,Currency,Tags,Source,Order #,Category,Exclude?,Recurring?,Notes';

describe('parseSheetTransactionsCsv', () => {
  it('parses the PRD example row end to end', () => {
    const csv = [
      HEADER,
      `2026-08-24,Capital One VentureOne …9645,Air France,"(1,648.50)",USD,project-london,Plaid,,Air Travel,FALSE,FALSE,Kelsey's ticket`,
    ].join('\n');
    const { rows, invalid } = parseSheetTransactionsCsv(csv);
    expect(invalid).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      postedOn: '2026-08-24',
      account: 'Capital One VentureOne …9645',
      description: 'Air France',
      amountCents: -164850,
      currencyCode: 'USD',
      tags: ['project-london'],
      source: 'Plaid',
      category: 'Air Travel',
      excluded: false,
      recurring: false,
      notes: "Kelsey's ticket",
    });
  });

  it('parses accounting positives, plain negatives, and flags', () => {
    const csv = [
      HEADER,
      '2026-01-05,Apple Cash,Paycheck,"1,198.50",USD,,manual,,Income,FALSE,FALSE,',
      '2026-01-06,Apple Card,Netflix,-15.99,USD,,Plaid,ABC-123,Streaming,TRUE,TRUE,monthly sub',
    ].join('\n');
    const { rows, invalid } = parseSheetTransactionsCsv(csv);
    expect(invalid).toEqual([]);
    expect(rows[0]).toMatchObject({ amountCents: 119850, excluded: false, recurring: false });
    expect(rows[1]).toMatchObject({
      amountCents: -1599,
      excluded: true,
      recurring: true,
      orderNumber: 'ABC-123',
      notes: 'monthly sub',
    });
  });

  it('splits comma tags and drops empties', () => {
    const csv = [HEADER, '2026-02-01,Cash,Coffee,-3.50,USD,"a, ,b",manual,,,,,'].join('\n');
    const { rows } = parseSheetTransactionsCsv(csv);
    expect(rows[0]?.tags).toEqual(['a', 'b']);
  });

  it('collects invalid rows without throwing', () => {
    const csv = [
      HEADER,
      'not-a-date,Cash,Coffee,-3.50,USD,,manual,,,,,',
      '2026-02-01,Cash,NoAmount,,USD,,manual,,,,,',
      '2026-02-02,Cash,Tea,-2.00,USD,,manual,,,,,',
    ].join('\n');
    const { rows, invalid } = parseSheetTransactionsCsv(csv);
    expect(rows).toHaveLength(1);
    expect(invalid).toHaveLength(2);
    expect(invalid[0]).toMatchObject({ line: 2 });
    expect(invalid[1]).toMatchObject({ line: 3 });
  });

  it('skips blank lines and tolerates a missing header', () => {
    const csv = ['2026-03-01,Cash,Tea,-2.00,USD,,manual,,,,,', ''].join('\n');
    const { rows, invalid } = parseSheetTransactionsCsv(csv);
    expect(invalid).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ description: 'Tea', amountCents: -200 });
  });

  it('keeps embedded newlines inside quoted cells in one record', () => {
    const csv = [
      HEADER,
      '2026-03-02,Cash,Dinner,-45.00,USD,,manual,,Dining Out,FALSE,FALSE,"line one',
      'line two"',
      '2026-03-03,Cash,Tea,-2.00,USD,,manual,,,,,',
    ].join('\n');
    const { rows, invalid } = parseSheetTransactionsCsv(csv);
    expect(invalid).toEqual([]);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.notes).toBe('line one\nline two');
    expect(rows[1]).toMatchObject({ description: 'Tea' });
  });
});
