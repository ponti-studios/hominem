import { describe, expect, it } from 'vitest';

import type { CatalogPlan, CatalogPriceSnapshot, StripeCatalogFacts } from './stripe-catalog-audit';
import { verifyStripeCatalog } from './stripe-catalog-audit';
import type { StripeTestFinding } from './stripe-test-verify';

/**
 * The ticket's launch catalog, restated here on purpose. The audit's expectations come from the
 * same modules the running app resolves with, so the tests hard-code the ticket table to catch
 * drift between the two.
 */
const TICKET_CATALOG = {
  core: { display: 'Core', key: 'hominem_core_monthly', tier: 'core', pence: 999 },
  rhodium: { display: 'Rhodium', key: 'hominem_rhodium_monthly', tier: 'rhodium', pence: 1999 },
  iridium: { display: 'Iridium', key: 'hominem_iridium_monthly', tier: 'iridium', pence: 3999 },
  founding_core: {
    display: 'Founding Core',
    key: 'hominem_founding_core_monthly',
    tier: 'core',
    pence: 799,
    founding: 'true',
  },
} as const;

function price(
  plan: CatalogPlan,
  overrides: Partial<CatalogPriceSnapshot> = {},
): CatalogPriceSnapshot {
  const expected = TICKET_CATALOG[plan];
  const metadata: Record<string, string> = { tier: expected.tier, plan: 'monthly' };
  if ('founding' in expected) metadata.founding = expected.founding;
  return {
    id: `price_${plan}`,
    active: true,
    lookupKey: expected.key,
    currency: 'gbp',
    unitAmount: expected.pence,
    taxBehavior: 'inclusive',
    type: 'recurring',
    interval: 'month',
    metadata,
    product: { id: `prod_${plan}`, active: true, taxCode: 'txcd_10105001' },
    ...overrides,
  };
}

function catalogPrices(
  overrides: Partial<Record<CatalogPlan, CatalogPriceSnapshot[]>> = {},
): StripeCatalogFacts['prices'] {
  return {
    core: [price('core')],
    rhodium: [price('rhodium')],
    iridium: [price('iridium')],
    founding_core: [price('founding_core')],
    ...overrides,
  };
}

function facts(overrides: Partial<StripeCatalogFacts> = {}): StripeCatalogFacts {
  return {
    livemode: true,
    prices: catalogPrices(),
    accountDefaultTaxCode: 'txcd_10105001',
    ...overrides,
  };
}

function priceLabel(plan: CatalogPlan): string {
  const expected = TICKET_CATALOG[plan];
  return `${expected.display} catalog price (£${(expected.pence / 100).toFixed(2)}/month)`;
}

function productLabel(plan: CatalogPlan): string {
  return `${TICKET_CATALOG[plan].display} product on the AIaaS tax category`;
}

function oneFinding(findings: StripeTestFinding[], label: string): StripeTestFinding {
  const match = findings.find((finding) => finding.label === label);
  if (!match) throw new Error(`no finding labeled ${label}`);
  return match;
}

/** The finding labels, in the order the ticket's catalog table lists the plans. */
const EXPECTED_LABELS = [
  'Live mode',
  priceLabel('core'),
  productLabel('core'),
  priceLabel('rhodium'),
  productLabel('rhodium'),
  priceLabel('iridium'),
  productLabel('iridium'),
  priceLabel('founding_core'),
  productLabel('founding_core'),
  'Account default tax category',
];

describe('verifyStripeCatalog', () => {
  it('matches the launch catalog on a live key', () => {
    const findings = verifyStripeCatalog(facts());
    expect(findings.map((finding) => finding.label)).toEqual(EXPECTED_LABELS);
    expect(findings.every((finding) => finding.ok)).toBe(true);
  });

  it('flags a test-mode key', () => {
    const findings = verifyStripeCatalog(facts({ livemode: false }));
    const failed = findings.filter((finding) => !finding.ok);
    expect(failed.map((finding) => finding.label)).toEqual(['Live mode']);
  });

  it('flags a lookup key that resolves to nothing', () => {
    const findings = verifyStripeCatalog(facts({ prices: catalogPrices({ core: [] }) }));
    const failed = findings.filter((finding) => !finding.ok);
    expect(failed.map((finding) => finding.label)).toEqual([
      priceLabel('core'),
      productLabel('core'),
    ]);
    expect(oneFinding(findings, priceLabel('core')).fix).toContain('no active price');
  });

  it('flags a lookup key shared by two active prices', () => {
    const findings = verifyStripeCatalog(
      facts({ prices: catalogPrices({ core: [price('core'), price('core')] }) }),
    );
    expect(oneFinding(findings, priceLabel('core')).fix).toContain('2 active prices');
  });

  it('flags a non-GBP price', () => {
    const findings = verifyStripeCatalog(
      facts({ prices: catalogPrices({ core: [price('core', { currency: 'usd' })] }) }),
    );
    expect(oneFinding(findings, priceLabel('core')).fix).toContain('currency is usd');
  });

  it('flags a drifted amount', () => {
    const findings = verifyStripeCatalog(
      facts({ prices: catalogPrices({ core: [price('core', { unitAmount: 1099 })] }) }),
    );
    expect(oneFinding(findings, priceLabel('core')).fix).toContain('expected 999p');
  });

  it('flags an unset unit amount', () => {
    const findings = verifyStripeCatalog(
      facts({ prices: catalogPrices({ core: [price('core', { unitAmount: null })] }) }),
    );
    expect(oneFinding(findings, priceLabel('core')).fix).toContain('its unit_amount is unset');
  });

  it('flags a one-time price', () => {
    const findings = verifyStripeCatalog(
      facts({ prices: catalogPrices({ core: [price('core', { type: 'one_time' })] }) }),
    );
    expect(oneFinding(findings, priceLabel('core')).fix).toContain('type is one_time');
  });

  it('flags a yearly interval', () => {
    const findings = verifyStripeCatalog(
      facts({ prices: catalogPrices({ core: [price('core', { interval: 'year' })] }) }),
    );
    expect(oneFinding(findings, priceLabel('core')).fix).toContain('interval is year');
  });

  it('flags a tax-exclusive price', () => {
    const findings = verifyStripeCatalog(
      facts({ prices: catalogPrices({ core: [price('core', { taxBehavior: 'exclusive' })] }) }),
    );
    expect(oneFinding(findings, priceLabel('core')).fix).toContain('tax behavior is exclusive');
  });

  it('flags wrong tier metadata', () => {
    const findings = verifyStripeCatalog(
      facts({
        prices: catalogPrices({
          core: [price('core', { metadata: { tier: 'rhodium', plan: 'monthly' } })],
        }),
      }),
    );
    expect(oneFinding(findings, priceLabel('core')).fix).toContain(
      'tier metadata is rhodium, expected core',
    );
  });

  it('flags a non-monthly plan metadata', () => {
    const findings = verifyStripeCatalog(
      facts({
        prices: catalogPrices({
          core: [price('core', { metadata: { tier: 'core', plan: 'annual' } })],
        }),
      }),
    );
    expect(oneFinding(findings, priceLabel('core')).fix).toContain('plan metadata is annual');
  });

  it('flags founding metadata on a public price', () => {
    const findings = verifyStripeCatalog(
      facts({
        prices: catalogPrices({
          core: [price('core', { metadata: { tier: 'core', plan: 'monthly', founding: 'true' } })],
        }),
      }),
    );
    expect(oneFinding(findings, priceLabel('core')).fix).toContain(
      'founding metadata must be absent or false',
    );
  });

  it('flags Founding Core without its founding marker', () => {
    const findings = verifyStripeCatalog(
      facts({
        prices: catalogPrices({
          founding_core: [
            price('founding_core', {
              metadata: { tier: 'core', plan: 'monthly', founding: 'false' },
            }),
          ],
        }),
      }),
    );
    expect(oneFinding(findings, priceLabel('founding_core')).fix).toContain(
      'founding metadata must be true',
    );
  });

  it('flags an inactive product', () => {
    const findings = verifyStripeCatalog(
      facts({
        prices: catalogPrices({
          core: [
            price('core', {
              product: { id: 'prod_core', active: false, taxCode: 'txcd_10105001' },
            }),
          ],
        }),
      }),
    );
    expect(oneFinding(findings, productLabel('core')).fix).toContain('it is inactive');
  });

  it('flags a product off the AIaaS tax category', () => {
    const findings = verifyStripeCatalog(
      facts({
        prices: catalogPrices({
          core: [
            price('core', { product: { id: 'prod_core', active: true, taxCode: 'txcd_20060048' } }),
          ],
        }),
      }),
    );
    expect(oneFinding(findings, productLabel('core')).fix).toContain('on txcd_20060048');
  });

  it('flags a missing product', () => {
    const findings = verifyStripeCatalog(
      facts({ prices: catalogPrices({ core: [price('core', { product: null })] }) }),
    );
    expect(oneFinding(findings, productLabel('core')).fix).toContain('No product sits behind');
  });

  it('flags a wrong account default tax category', () => {
    const findings = verifyStripeCatalog(facts({ accountDefaultTaxCode: 'txcd_20060048' }));
    const failed = findings.filter((finding) => !finding.ok);
    expect(failed.map((finding) => finding.label)).toEqual(['Account default tax category']);
    expect(failed[0].fix).toContain('tax settings report txcd_20060048');
  });

  it('flags an unset account default tax category', () => {
    const findings = verifyStripeCatalog(facts({ accountDefaultTaxCode: null }));
    expect(oneFinding(findings, 'Account default tax category').fix).toContain(
      'tax settings report none',
    );
  });
});
