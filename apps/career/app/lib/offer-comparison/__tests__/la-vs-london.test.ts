// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { computeUSTax } from '../tax';
import { computeUKTax } from '../tax';

describe('LA vs London — real case from comparison doc', () => {
  // LA: $215k, single, California
  // Expected from doc: ~$12,200/mo net, ~31-33% effective
  it('computes LA tax correctly', () => {
    const result = computeUSTax(215_000, 'california', 'single');

    // Doc expected: ~$12,200/mo net, 31-33% effective
    expect(result.netMonthly).toBeCloseTo(12_041, -2);
    expect(result.effectiveRate).toBeCloseTo(32.8, 0);
  });

  it('computes UK tax correctly', () => {
    const result = computeUKTax(140_000);

    // Doc expected: ~£7,166/mo net, ~39% effective
    expect(result.netMonthly).toBe(7_166);
    expect(result.netAnnual).toBe(85_986);
    expect(result.effectiveRate).toBeCloseTo(38.6, 0);
  });
});
