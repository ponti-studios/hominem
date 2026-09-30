import { describe, expect, it } from 'vitest';

import {
  inferCurrency,
  mapContainerRow,
  mapShoppingRow,
  mapPossessionRow,
  parseIsoDate,
  parseMoneyCents,
  parseStatus,
} from './possession-import';

describe('parsers', () => {
  it('parses money to cents and ignores blanks', () => {
    expect(parseMoneyCents('$229.94')).toBe(22994);
    expect(parseMoneyCents('$0.00')).toBe(0);
    expect(parseMoneyCents('1,234.5')).toBe(123450);
    expect(parseMoneyCents('')).toBeNull();
    expect(parseMoneyCents(undefined)).toBeNull();
  });
  it('accepts only real ISO dates', () => {
    expect(parseIsoDate('2022-10-06')).toBe('2022-10-06');
    expect(parseIsoDate('2022-13-40')).toBeNull();
    expect(parseIsoDate('10/06/2022')).toBeNull();
  });
  it('normalises statuses', () => {
    expect(parseStatus('Owned')).toBe('owned');
    expect(parseStatus('in use')).toBe('in_use');
    expect(parseStatus('mystery')).toBeNull();
  });
});

describe('mapPossessionRow', () => {
  const docking = {
    'Column 1': 'ITM-0001',
    item_id: '15-in-1 Docking Station',
    brand: 'Orico',
    status: 'owned',
    category: 'technology',
    sub_category: 'docking_station',
    model: 'TB3-S3',
    acquired_date: '2022-10-06',
    purchase_price: '$229.94',
    container_id: 'CON-023',
    move_action: 'ziploc_antique_electronics',
    acquisition_type: 'purchased',
    purchase_currency: 'USD',
    ownership_type: 'functional',
  };
  it('maps a purchased, owned item', () => {
    const mapped = mapPossessionRow(docking)!;
    expect(mapped.externalId).toBe('ITM-0001');
    expect(mapped.containerExternalId).toBe('CON-023');
    expect(mapped.input).toMatchObject({
      name: '15-in-1 Docking Station',
      category: 'technology',
      status: 'owned',
      isArchived: false,
      priceCents: 22994,
      currencyCode: 'USD',
      placement: 'ziploc_antique_electronics',
    });
    expect(mapped.input.metadata).toMatchObject({
      acquisitionType: 'purchased',
      ownershipType: 'functional',
    });
  });
  it('archives disposed items and drops the meaningless size 0', () => {
    const mapped = mapPossessionRow({
      ...docking,
      'Column 1': 'ITM-0202',
      status: 'disposed',
      size: '0',
      retirement_method: 'discarded',
    })!;
    expect(mapped.input.isArchived).toBe(true);
    expect(mapped.input.size).toBeNull();
    expect(mapped.input.metadata).toMatchObject({ retirementMethod: 'discarded' });
  });
  it('skips debris rows and warns about unknown statuses', () => {
    expect(mapPossessionRow({ 'Column 1': '#REF!' })).toBeNull();
    expect(mapPossessionRow({ 'Column 1': 'Column 1', item_id: 'item_id' })).toBeNull();
    expect(mapPossessionRow({ ...docking, status: 'mystery' })!.warnings).toHaveLength(1);
  });
});

describe('mapContainerRow', () => {
  it('maps nesting, weight and source item', () => {
    const mapped = mapContainerRow({
      container_id: 'CON-007',
      name: 'pouch_camera',
      container_type: 'pouch',
      status: 'active',
      container_kind: 'organizational',
      source_item_id: 'ITM-0329',
      parent_container_id: 'CON-002',
      weight_kg: '2.322',
    })!;
    expect(mapped.parentExternalId).toBe('CON-002');
    expect(mapped.input).toMatchObject({
      name: 'pouch_camera',
      containerKind: 'organizational',
      weightKg: 2.322,
    });
    expect(mapped.input.metadata).toMatchObject({ sourceItemId: 'ITM-0329' });
  });
  it('skips rows without a CON id', () => {
    expect(mapContainerRow({ container_id: 'container_id', name: 'name' })).toBeNull();
  });
});

describe('currency and status edge cases', () => {
  it('prefers a price symbol over a blank currency column', () => {
    expect(inferCurrency('£30.00', '')).toBe('GBP');
    expect(inferCurrency('$5', 'GBP')).toBe('USD');
    expect(inferCurrency('12', 'usd')).toBe('USD');
    expect(inferCurrency('12', '')).toBeNull();
  });
  it('treats sold and donated as disposed and keeps the original word', () => {
    expect(parseStatus('donated')).toBe('disposed');
    const mapped = mapPossessionRow({
      'Column 1': 'ITM-0009',
      item_id: 'TV',
      status: 'sold',
      sale_price: '350',
    })!;
    expect(mapped.input).toMatchObject({
      status: 'disposed',
      isArchived: true,
      sellPriceCents: 35000,
    });
    expect(mapped.input.metadata).toMatchObject({ originalStatus: 'sold' });
  });
});

describe('mapShoppingRow', () => {
  const today = new Date('2026-09-29T12:00:00Z');
  const base = {
    'order date': '2026-09-22',
    Category: 'technology',
    Subcategory: 'power_accessory',
    'Item type': 'Power lead',
    Product: 'C2G Figure 8',
    Quantity: '3',
    Source: 'https://www.amazon.co.uk/dp/B00H7COWHG',
    Priority: 'Essential',
    price: '4.99',
    'Delivery day': '2026-09-23',
    'Order #': '202-8319460-2213900',
  };
  it('uses the line total, GBP for UK stores, and marks arrived orders delivered', () => {
    const { input } = mapShoppingRow(base, 1, today)!;
    expect(input).toMatchObject({
      name: 'Power lead (C2G Figure 8) ×3',
      status: 'delivered',
      priceCents: 1497,
      currencyCode: 'GBP',
    });
    expect(input.metadata).toMatchObject({
      orderNumber: '202-8319460-2213900',
      merchant: 'Amazon UK',
      priority: 'Essential',
      quantity: 3,
    });
  });
  it('only treats a real .co.uk hostname as a UK store', () => {
    const spoof = mapShoppingRow(
      { ...base, Source: 'https://evil.com/?x=.co.uk', price: '10' },
      1,
      today,
    )!;
    expect(spoof.input.currencyCode).toBeNull();
    expect(mapShoppingRow({ ...base, Source: 'Argos' }, 1, today)!.input.currencyCode).toBe('GBP');
  });
  it('is ordered while delivery is in the future, wishlist without an order', () => {
    expect(mapShoppingRow({ ...base, 'Delivery day': '2026-10-05' }, 1, today)!.input.status).toBe(
      'ordered',
    );
    expect(
      mapShoppingRow({ ...base, 'Order #': '', 'Delivery day': '', 'order date': '' }, 1, today)!
        .input.status,
    ).toBe('wishlist');
  });
  it('gives stable ids, distinct for exact repeats, and skips blank rows', () => {
    const a = mapShoppingRow(base, 1, today)!.externalId;
    expect(mapShoppingRow(base, 1, today)!.externalId).toBe(a);
    expect(mapShoppingRow(base, 2, today)!.externalId).toBe(`${a}-2`);
    expect(mapShoppingRow({ Category: 'x' }, 1, today)).toBeNull();
  });
});
