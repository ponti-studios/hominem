/**
 * Read-only Stripe catalog audit (PON-254 W-005, docs/billing-test-plan.md): fetches the
 * account tax settings and every launch-catalog price with its expanded product, then judges
 * them with the tested pure module. It only ever GETs, and it never prints key material.
 *
 * Usage: just billing stripe-audit
 *
 * It prefers STRIPE_LIVE_SECRET_KEY from the ignored services/api/.env — where the live key
 * for the production audit is dropped by hand — and falls back to STRIPE_SECRET_KEY, so the
 * same command proves the pipeline against the Test Mode catalog: there exactly the
 * live-mode and account-default findings fail, everything else must pass.
 */
import 'dotenv/config';
import { z } from 'zod';

import { STRIPE_API_VERSION, CATALOG_PRICES } from '../src/application/stripe';
import {
  CATALOG_ORDER,
  verifyStripeCatalog,
  type CatalogPlan,
  type CatalogPriceSnapshot,
} from '../src/application/stripe-catalog-audit';
import { die, printFindings } from './stripe-session';

const BASE = 'https://api.stripe.com/v1';

const key = process.env.STRIPE_LIVE_SECRET_KEY ?? process.env.STRIPE_SECRET_KEY;
if (!key || key.length === 0) {
  die(
    'No Stripe key to audit with — set STRIPE_SECRET_KEY (Test Mode) or STRIPE_LIVE_SECRET_KEY (live) in services/api/.env',
  );
}

async function get(path: string): Promise<unknown> {
  const response = await fetch(`${BASE}${path}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${key}`, 'Stripe-Version': STRIPE_API_VERSION },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    // Only Stripe's short error code is kept; the body can hold customer details.
    const failure = await response.json().catch(() => null);
    const code = z.object({ error: z.object({ code: z.string() }) }).safeParse(failure);
    die(
      `Stripe GET ${path} failed (${response.status}${code.success ? `, ${code.data.error.code}` : ''})`,
    );
  }
  return response.json();
}

const taxSettingsSchema = z.object({
  livemode: z.boolean(),
  defaults: z.object({ tax_code: z.string().nullable() }),
});

const productSchema = z.object({
  id: z.string().min(1),
  active: z.boolean(),
  tax_code: z.string().nullable().optional(),
  tax_details: z.object({ tax_code: z.string().nullable().optional() }).nullable().optional(),
});

const priceSchema = z.object({
  id: z.string().min(1),
  active: z.boolean(),
  lookup_key: z.string().nullable(),
  currency: z.string(),
  unit_amount: z.number().int().nullable(),
  tax_behavior: z.enum(['inclusive', 'exclusive', 'unspecified']).nullable(),
  type: z.string(),
  recurring: z.object({ interval: z.string() }).nullable(),
  metadata: z.record(z.string(), z.string()).nullable(),
  product: productSchema.nullable().optional(),
});

const priceListSchema = z.object({ data: z.array(priceSchema) });

function toSnapshot(price: z.infer<typeof priceSchema>): CatalogPriceSnapshot {
  const product = price.product ?? null;
  return {
    id: price.id,
    active: price.active,
    lookupKey: price.lookup_key ?? '',
    currency: price.currency,
    unitAmount: price.unit_amount ?? null,
    taxBehavior: price.tax_behavior,
    type: price.type,
    interval: price.recurring?.interval ?? null,
    metadata: price.metadata ?? {},
    product:
      product === null
        ? null
        : {
            id: product.id,
            active: product.active,
            taxCode: product.tax_code ?? product.tax_details?.tax_code ?? null,
          },
  };
}

async function fetchCatalogPrices(): Promise<Record<CatalogPlan, CatalogPriceSnapshot[]>> {
  const prices: Record<CatalogPlan, CatalogPriceSnapshot[]> = {
    core: [],
    rhodium: [],
    iridium: [],
    founding_core: [],
  };
  for (const plan of CATALOG_ORDER) {
    const query = new URLSearchParams({ active: 'true', limit: '100' });
    query.append('lookup_keys[]', CATALOG_PRICES[plan].key);
    query.append('expand[]', 'data.product');
    const list = priceListSchema.parse(await get(`/prices?${query.toString()}`));
    prices[plan] = list.data.map(toSnapshot);
  }
  return prices;
}

async function main(): Promise<void> {
  const taxSettings = taxSettingsSchema.parse(await get('/tax/settings'));
  console.log(
    `\n> Auditing the ${taxSettings.livemode ? 'live' : 'Test Mode'} catalog — read-only, GETs only`,
  );
  const findings = verifyStripeCatalog({
    livemode: taxSettings.livemode,
    prices: await fetchCatalogPrices(),
    accountDefaultTaxCode: taxSettings.defaults.tax_code,
  });
  const passing = findings.filter((finding) => finding.ok).length;
  printFindings(`Stripe catalog audit (${passing}/${findings.length} findings pass)`, findings);
  process.exitCode = findings.every((finding) => finding.ok) ? 0 : 1;
}

await main().catch((error: unknown) => die(error instanceof Error ? error.message : String(error)));
