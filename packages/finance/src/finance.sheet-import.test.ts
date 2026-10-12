import { describe, expect, it } from 'vitest';

import {
  combineNotes,
  computeSheetExternalId,
  inferTransactionType,
  isIsoDate,
  normalizeDescription,
  normalizeSource,
  parseTags,
  toSheetRejectionReason,
} from './sheet-import';

describe('sheet-import pure transforms', () => {
  it('normalizes descriptions for key computation only', () => {
    expect(normalizeDescription('  Air   France\t')).toBe('air france');
  });

  it('validates ISO dates strictly', () => {
    expect(isIsoDate('2026-08-24')).toBe(true);
    expect(isIsoDate('2026-13-01')).toBe(false);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('08/24/2026')).toBe(false);
  });

  it('normalizes source with manual fallback', () => {
    expect(normalizeSource('Plaid')).toBe('plaid');
    expect(normalizeSource('Starling')).toBe('starling');
    expect(normalizeSource('weird')).toBe('manual');
    expect(normalizeSource(null)).toBe('manual');
  });

  it('detects transfers by description substring, else sign', () => {
    expect(inferTransactionType('Internet Transfer To Savings', -100, null)).toBe('transfer');
    expect(inferTransactionType('transfer from starling', 5000, null)).toBe('transfer');
    expect(inferTransactionType('Grocery Store', -5000, null)).toBe('debit');
    expect(inferTransactionType('Paycheck', 200000, null)).toBe('credit');
    expect(inferTransactionType('Autopay Electric Bill', -3000, null)).toBe('debit');
    expect(inferTransactionType('McDonalds', -108, 'credit')).toBe('credit');
  });

  it('combines notes with order number and truncates', () => {
    expect(combineNotes(null, null)).toBeNull();
    expect(combineNotes('  hello ', ' 123 ')).toBe('hello\nOrder #: 123');
    expect(combineNotes('x'.repeat(3000), null)?.length).toBe(2000);
  });

  it('splits tags on commas and dedupes case-insensitively', () => {
    expect(parseTags(['project-london', ' Project-London , travel '])).toEqual([
      'project-london',
      'travel',
    ]);
    expect(parseTags(undefined)).toEqual([]);
  });

  it('computes a stable natural key', () => {
    const a = computeSheetExternalId('2026-08-24', 'acct-1', 'Air France', -164850, 'USD');
    const b = computeSheetExternalId('2026-08-24', 'acct-1', '  air   FRANCE ', -164850, 'USD');
    const c = computeSheetExternalId('2026-08-24', 'acct-1', 'Air France', -164851, 'USD');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a.startsWith('sheet:')).toBe(true);
  });

  it('classifies only recognized domain errors, never masking operational failures', () => {
    expect(toSheetRejectionReason(new Error('currency_mismatch'))).toBe('currency_mismatch');
    expect(toSheetRejectionReason(new Error('pending_row'))).toBe('pending_row');
    expect(toSheetRejectionReason(new Error('relation "x" does not exist'))).toBeNull();
    expect(toSheetRejectionReason('bang')).toBeNull();
  });
});
