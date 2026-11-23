/**
 * Assertions for the Stripe launch catalog (PON-254 W-005, docs/billing-test-plan.md). Pure:
 * the calling script fetches the account tax settings and every catalog price with its
 * product and passes them as facts; this module judges them against the same catalog the
 * running app resolves subscriptions with, so the end-to-end assertions are themselves
 * tested.
 */
import { pricePenceFor } from './billing';
import { CATALOG_PRICES } from './stripe';
import type { StripeTestFinding } from './stripe-test-verify';

export type CatalogPlan = keyof typeof CATALOG_PRICES;

export interface CatalogProductSnapshot {
  id: string;
  active: boolean;
  taxCode: string | null;
}

export interface CatalogPriceSnapshot {
  id: string;
  active: boolean;
  lookupKey: string;
  currency: string;
  unitAmount: number | null;
  taxBehavior: string | null;
  type: string;
  interval: string | null;
  metadata: Record<string, string>;
  product: CatalogProductSnapshot | null;
}

export interface StripeCatalogFacts {
  livemode: boolean;
  prices: Record<CatalogPlan, CatalogPriceSnapshot[]>;
  accountDefaultTaxCode: string | null;
}

/** The tax category for AI as a Service, the category every Hominem product must carry. */
const AI_TOKENS_TAX_CODE = 'txcd_10105001';

const PLAN_DISPLAY: Record<CatalogPlan, string> = {
  core: 'Core',
  rhodium: 'Rhodium',
  iridium: 'Iridium',
  founding_core: 'Founding Core',
};

/** The finding order matches the ticket's launch catalog table. */
export const CATALOG_ORDER: CatalogPlan[] = ['core', 'rhodium', 'iridium', 'founding_core'];

function priceLabel(plan: CatalogPlan): string {
  const expectedPence = expectedPenceFor(plan);
  return `${PLAN_DISPLAY[plan]} catalog price (£${(expectedPence / 100).toFixed(2)}/month)`;
}

function productLabel(plan: CatalogPlan): string {
  return `${PLAN_DISPLAY[plan]} product on the AIaaS tax category`;
}

function expectedPenceFor(plan: CatalogPlan): number {
  const entry = CATALOG_PRICES[plan];
  return pricePenceFor(entry.tier, plan === 'founding_core');
}

function priceFinding(plan: CatalogPlan, prices: CatalogPriceSnapshot[]): StripeTestFinding {
  const entry = CATALOG_PRICES[plan];
  if (prices.length === 0) {
    return {
      ok: false,
      label: priceLabel(plan),
      fix: `lookup key ${entry.key} resolves to no active price — create it (or unarchive it) at the launch amount`,
    };
  }
  if (prices.length > 1) {
    return {
      ok: false,
      label: priceLabel(plan),
      fix: `${prices.length} active prices share the lookup key ${entry.key} — archive all but one`,
    };
  }
  const price = prices[0]!;
  const mismatches = priceMismatches(plan, price);
  return { ok: mismatches.length === 0, label: priceLabel(plan), fix: mismatches.join('; ') };
}

function priceMismatches(plan: CatalogPlan, price: CatalogPriceSnapshot): string[] {
  const entry = CATALOG_PRICES[plan];
  const metadata = price.metadata;
  const expectedPence = expectedPenceFor(plan);
  const mismatches: string[] = [];
  if (!price.active) mismatches.push('it is inactive in Stripe — unarchive it');
  if (price.currency !== 'gbp') mismatches.push(`its currency is ${price.currency}, expected gbp`);
  if (price.unitAmount !== expectedPence) {
    const actual = price.unitAmount === null ? 'unset' : `${price.unitAmount}p`;
    mismatches.push(`its unit_amount is ${actual}, expected ${expectedPence}p`);
  }
  if (price.type !== 'recurring') mismatches.push(`its type is ${price.type}, expected recurring`);
  if (price.interval !== 'month') {
    mismatches.push(`its recurring interval is ${price.interval ?? 'none'}, expected month`);
  }
  if (price.taxBehavior !== 'inclusive') {
    mismatches.push(`its tax behavior is ${price.taxBehavior ?? 'unset'}, expected inclusive`);
  }
  if (metadata.tier !== entry.tier) {
    mismatches.push(`its tier metadata is ${metadata.tier ?? 'missing'}, expected ${entry.tier}`);
  }
  if (metadata.plan !== 'monthly') {
    mismatches.push(`its plan metadata is ${metadata.plan ?? 'missing'}, expected monthly`);
  }
  if (plan === 'founding_core') {
    if (metadata.founding !== 'true') {
      mismatches.push(
        'its founding metadata must be true so a grandfathered subscriber is recognized',
      );
    }
  } else if (metadata.founding === 'true') {
    mismatches.push('its founding metadata must be absent or false, not true');
  }
  return mismatches;
}

function productFinding(plan: CatalogPlan, prices: CatalogPriceSnapshot[]): StripeTestFinding {
  const entry = CATALOG_PRICES[plan];
  if (prices.length === 0) {
    return {
      ok: false,
      label: productLabel(plan),
      fix: `No product sits behind ${entry.key} — the lookup resolves to nothing`,
    };
  }
  if (prices.length > 1) {
    return {
      ok: false,
      label: productLabel(plan),
      fix: `${prices.length} active prices share the lookup key ${entry.key} — pin the catalog to one`,
    };
  }
  const product = prices[0]!.product;
  if (product === null) {
    return {
      ok: false,
      label: productLabel(plan),
      fix: `No product sits behind ${entry.key} — expand data.product on the price lookup`,
    };
  }
  const issues: string[] = [];
  if (!product.active) issues.push(`it is inactive — reactivate ${product.id}`);
  if (product.taxCode !== AI_TOKENS_TAX_CODE) {
    issues.push(
      `${product.id} sits on ${product.taxCode ?? 'no tax category'}, expected ${AI_TOKENS_TAX_CODE}`,
    );
  }
  return { ok: issues.length === 0, label: productLabel(plan), fix: issues.join('; ') };
}

function accountTaxFinding(taxCode: string | null): StripeTestFinding {
  const fix =
    taxCode === null
      ? `tax settings report none — set the account default tax category to ${AI_TOKENS_TAX_CODE} (AIaaS)`
      : `tax settings report ${taxCode}, expected ${AI_TOKENS_TAX_CODE} (AIaaS)`;
  return { ok: taxCode === AI_TOKENS_TAX_CODE, label: 'Account default tax category', fix };
}

export function verifyStripeCatalog(facts: StripeCatalogFacts): StripeTestFinding[] {
  return [
    {
      ok: facts.livemode,
      label: 'Live mode',
      fix: 'the audited key is test-mode — the live audit needs the live-mode secret key in services/api/.env as STRIPE_LIVE_SECRET_KEY (sk_live…), never committed anywhere',
    },
    ...CATALOG_ORDER.flatMap((plan) => [
      priceFinding(plan, facts.prices[plan]),
      productFinding(plan, facts.prices[plan]),
    ]),
    accountTaxFinding(facts.accountDefaultTaxCode),
  ];
}
