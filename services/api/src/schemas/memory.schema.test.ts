import { describe, expect, it } from 'vitest';

import { listMemoriesInputSchema, listMemoriesPageInputSchema } from './memory.schema';

describe('listMemoriesInputSchema limit', () => {
  it('accepts a numeric string from a query string', () => {
    expect(listMemoriesInputSchema.parse({ limit: '5' })).toEqual({ limit: 5 });
  });

  it('accepts a number and an omitted limit', () => {
    expect(listMemoriesInputSchema.parse({ limit: 5 })).toEqual({ limit: 5 });
    expect(listMemoriesInputSchema.parse({})).toEqual({});
  });

  it('rejects non-numeric values instead of coercing them', () => {
    for (const limit of [true, null, [], '', 'abc', '0', '51', '1.5']) {
      expect(listMemoriesInputSchema.safeParse({ limit }).success).toBe(false);
    }
  });
});

describe('listMemoriesPageInputSchema', () => {
  it('defaults to nothing set and accepts a numeric limit up to 100', () => {
    expect(listMemoriesPageInputSchema.parse({})).toEqual({});
    expect(listMemoriesPageInputSchema.parse({ limit: '100' }).limit).toBe(100);
  });

  it('rejects limits outside 1 to 100 and dates that are not dates', () => {
    expect(listMemoriesPageInputSchema.safeParse({ limit: '101' }).success).toBe(false);
    expect(listMemoriesPageInputSchema.safeParse({ limit: '0' }).success).toBe(false);
    expect(listMemoriesPageInputSchema.safeParse({ since: 'yesterday' }).success).toBe(false);
    expect(listMemoriesPageInputSchema.safeParse({ since: '2026-02-15T00:00:00Z' }).success).toBe(
      true,
    );
  });
});
