import { createHash } from 'node:crypto';

import type {
  ContainerInput,
  Json,
  PossessionInput,
  PossessionStatus,
} from '@hominem/db/possessions';
import { POSSESSION_STATUSES } from '@hominem/db/possessions';

// Maps rows of the user's "possessions" spreadsheet (master + containers tabs) onto repository
// inputs. Pure functions: no I/O, so the mapping can be tested without a database.

export type SheetRow = Record<string, string | undefined>;

const clean = (value: string | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

export function parseMoneyCents(value: string | undefined): number | null {
  const digits = clean(value)?.replace(/[^0-9.-]/g, '');
  if (!digits) return null;
  const amount = Number(digits);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : null;
}

export function parseIsoDate(value: string | undefined): string | null {
  const text = clean(value);
  if (!text || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const parsed = new Date(`${text}T00:00:00Z`);
  // Date normalises impossible dates (2022-02-30 becomes 2022-03-02), so require a round trip.
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text ? null : text;
}

const parseNumber = (value: string | undefined): number | null => {
  const text = clean(value);
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
};

// Ways an item leaves the inventory. All of them are "disposed" here; the wording is kept in metadata.
const LEFT_INVENTORY = new Set(['sold', 'donated', 'gifted', 'lost', 'given_away']);

export function parseStatus(value: string | undefined): PossessionStatus | null {
  const text = clean(value)
    ?.toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (text && LEFT_INVENTORY.has(text)) return 'disposed';
  return POSSESSION_STATUSES.find((status) => status === text) ?? null;
}

const SYMBOL_CURRENCY: Record<string, string> = { $: 'USD', '£': 'GBP', '€': 'EUR' };

// A currency symbol in the price text wins over the currency column, which is often blank.
export function inferCurrency(
  priceText: string | undefined,
  explicit: string | undefined,
): string | null {
  const symbol = clean(priceText)?.match(/[$£€]/)?.[0];
  if (symbol) return SYMBOL_CURRENCY[symbol] ?? null;
  return clean(explicit)?.toUpperCase() ?? null;
}

const compact = (record: Record<string, Json | undefined>) => {
  const kept: Record<string, Json> = {};
  for (const [key, value] of Object.entries(record)) {
    if (value !== null && value !== undefined) kept[key] = value;
  }
  return kept;
};

export interface MappedPossession {
  externalId: string;
  containerExternalId: string | null;
  input: PossessionInput & { externalId: string };
  warnings: string[];
}

export function mapPossessionRow(row: SheetRow): MappedPossession | null {
  const externalId = clean(row['Column 1'] ?? row['id']);
  const name = clean(row['item_id'] ?? row['name']);
  // Spreadsheet debris such as "#REF!" rows or the header repeated inside a tab.
  if (!externalId || !name || !/^ITM-\d+/i.test(externalId)) return null;

  const warnings: string[] = [];
  const rawStatus = clean(row['status']);
  const status = parseStatus(rawStatus ?? undefined);
  if (rawStatus && !status) warnings.push(`${externalId}: unknown status "${rawStatus}"`);

  const size = clean(row['size']);
  return {
    externalId,
    containerExternalId: clean(row['container_id']),
    warnings,
    input: {
      externalId,
      name,
      category: clean(row['category']),
      subCategory: clean(row['sub_category']),
      brand: clean(row['brand']),
      model: clean(row['model']),
      status,
      isArchived: status === 'disposed' || status === 'retired',
      acquiredDate: parseIsoDate(row['acquired_date']),
      retiredDate: parseIsoDate(row['retired_date']),
      priceCents: parseMoneyCents(row['purchase_price']),
      sellPriceCents: parseMoneyCents(row['sale_price']),
      currencyCode: inferCurrency(row['purchase_price'], row['purchase_currency']),
      color: clean(row['color']),
      size: size === '0' ? null : size,
      serialNumber: clean(row['serial_number']),
      placement: clean(row['move_action']),
      url: clean(row['url']),
      notes: clean(row['notes']),
      metadata: compact({
        weightKg: parseNumber(row['weight_kg']),
        volumeCbm: parseNumber(row['vol_cbm']),
        acquisitionType: clean(row['acquisition_type']),
        ownershipType: clean(row['ownership_type']),
        retirementMethod: clean(row['retirement_method']),
        originalStatus: rawStatus && rawStatus.toLowerCase() !== status ? rawStatus : null,
        importedFrom: 'possessions-sheet',
      }),
    },
  };
}

export interface MappedContainer {
  externalId: string;
  parentExternalId: string | null;
  input: ContainerInput & { externalId: string };
}

export function mapContainerRow(row: SheetRow): MappedContainer | null {
  const externalId = clean(row['container_id']);
  const name = clean(row['name']);
  if (!externalId || !name || !/^CON-\d+/i.test(externalId)) return null;
  return {
    externalId,
    parentExternalId: clean(row['parent_container_id']),
    input: {
      externalId,
      name,
      containerType: clean(row['container_type']),
      containerKind: clean(row['container_kind']),
      status: clean(row['status']) ?? 'active',
      description: clean(row['notes']),
      currentLocation: clean(row['current_location']),
      weightKg: parseNumber(row['weight_kg']),
      volumeCbm: parseNumber(row['vol_cbm']),
      metadata: compact({
        sourceItemId: clean(row['source_item_id']),
        trackingReference: clean(row['tracking_reference']),
        importedFrom: 'possessions-sheet',
      }),
    },
  };
}

// ── shopping sheet ──────────────────────────────────────────────────

export interface MappedShopping {
  externalId: string;
  input: PossessionInput & { externalId: string };
}

const isoOrNull = (value: string | undefined) =>
  parseIsoDate(clean(value)?.slice(0, 10) ?? undefined);

function hostnameOf(source: string): string | null {
  try {
    return new URL(source).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

export function merchantFrom(source: string | undefined): string | null {
  const text = clean(source);
  if (!text) return null;
  if (!/^https?:\/\//i.test(text)) return text;
  const host = hostnameOf(text);
  if (!host) return null;
  return host === 'amazon.co.uk' ? 'Amazon UK' : host;
}

// The shopping sheet has no currency column; its stores are UK retailers, recognised by hostname
// (never by substring, so a query string can't spoof it) or by a known UK name.
function isUkStore(source: string | null, merchant: string | null): boolean {
  if (source && /^https?:\/\//i.test(source) && hostnameOf(source)?.endsWith('.co.uk')) return true;
  return merchant !== null && /^(Amazon UK|Argos)$/i.test(merchant);
}

/**
 * One row of the shopping sheet becomes one possession. The sheet has no stable id, so the id is a
 * hash of the row's identifying columns (plus an occurrence counter for exact repeats) - re-importing
 * the same sheet updates rows in place. `price` is per unit; the possession carries the line total.
 */
export function mapShoppingRow(
  row: SheetRow,
  occurrence: number,
  today = new Date(),
): MappedShopping | null {
  const itemType = clean(row['Item type']);
  if (!itemType) return null;
  const product = clean(row['Product']);
  const source = clean(row['Source']);
  const orderNumber = clean(row['Order #']);
  const orderedOn = isoOrNull(row['order date']);
  const deliveryDate = isoOrNull(row['Delivery day']);
  const quantity = parseNumber(row['Quantity']) ?? 1;
  const unitCents = parseMoneyCents(row['price']);

  const key = [
    orderedOn,
    row['Category'],
    row['Subcategory'],
    itemType,
    product,
    source,
    orderNumber,
  ].join('|');
  const externalId = `SHOP-${createHash('sha1').update(key).digest('hex').slice(0, 10)}${occurrence > 1 ? `-${occurrence}` : ''}`;

  const hasOrder = Boolean(orderNumber || deliveryDate || orderedOn);
  const arrived = deliveryDate !== null && deliveryDate <= today.toISOString().slice(0, 10);
  const status: PossessionStatus = !hasOrder ? 'wishlist' : arrived ? 'delivered' : 'ordered';
  const merchant = merchantFrom(source ?? undefined);

  return {
    externalId,
    input: {
      externalId,
      name: `${itemType}${product ? ` (${product})` : ''}${quantity > 1 ? ` ×${quantity}` : ''}`,
      category: clean(row['Category']),
      subCategory: clean(row['Subcategory']),
      status,
      isArchived: false,
      acquiredDate: orderedOn,
      priceCents: unitCents === null ? null : Math.round(unitCents * quantity),
      currencyCode: inferCurrency(row['price'], isUkStore(source, merchant) ? 'GBP' : undefined),
      url: source && hostnameOf(source) ? source : null,
      notes: clean(row['Notes']),
      metadata: compact({
        quantity,
        unitPriceCents: unitCents,
        priority: clean(row['Priority']),
        merchant,
        orderNumber,
        deliveryDate,
        vendor: merchant,
        importedFrom: 'shopping-sheet',
      }),
    },
  };
}
