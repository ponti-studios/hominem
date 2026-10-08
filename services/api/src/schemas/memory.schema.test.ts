import { describe, expect, it } from 'vitest';

import { listMemoriesInputSchema } from './memory.schema';

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
