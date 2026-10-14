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
    expect(parseIsoDate('2022-02-30')).toBeNull();
    expect(parseIsoDate('2024-02-29')).toBe('2024-02-29');
    expect(parseIsoDate('2023-02-29')).toBeNull();
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
      purchaseCurrency: 'USD',
      // The vessel token moved to moveAction; the old placement convention is retired.
      placement: null,
      moveAction: 'ziploc_antique_electronics',
      acquisitionType: 'purchased',
      ownershipType: 'functional',
    });
    expect(mapped.input.metadata).toEqual({ importedFrom: 'possessions-sheet' });
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
    expect(mapped.input.retirementMethod).toBe('discarded');
    expect(mapped.input.metadata).toEqual({ importedFrom: 'possessions-sheet' });
  });
  it('skips debris rows and warns about unknown statuses', () => {
    expect(mapPossessionRow({ 'Column 1': '#REF!' })).toBeNull();
    expect(mapPossessionRow({ 'Column 1': 'Column 1', item_id: 'item_id' })).toBeNull();
    expect(mapPossessionRow({ ...docking, status: 'mystery' })!.warnings).toHaveLength(1);
  });
  it('flags unparseable weights, dates, and currency-less prices', () => {
    const mapped = mapPossessionRow({
      ...docking,
      'Column 1': 'ITM-0303',
      weight_kg: 'heavy',
      acquired_date: '10/06/2022',
      purchase_price: '12',
      purchase_currency: '',
    })!;
    expect(mapped.input.weightKg).toBeNull();
    expect(mapped.input.acquiredDate).toBeNull();
    expect(mapped.warnings).toHaveLength(3);
  });
  it('rejects negative weights instead of importing impossible mass', () => {
    const mapped = mapPossessionRow({ ...docking, 'Column 1': 'ITM-0304', weight_kg: '-2' })!;
    expect(mapped.input.weightKg).toBeNull();
    expect(mapped.warnings).toHaveLength(1);
    const container = mapContainerRow({
      container_id: 'CON-008',
      name: 'neg box',
      weight_kg: '-1',
    })!;
    expect(container.input.weightKg).toBeNull();
    expect(container.warnings).toHaveLength(1);
  });
});

describe('mapContainerRow', () => {
  it('maps nesting, weight and tracking reference', () => {
    const mapped = mapContainerRow({
      container_id: 'CON-007',
      name: 'pouch_camera',
      container_type: 'pouch',
      status: 'active',
      container_kind: 'organizational',
      source_item_id: 'ITM-0329',
      parent_container_id: 'CON-002',
      weight_kg: '2.322',
      tracking_reference: 'SMB-1',
    })!;
    expect(mapped.parentExternalId).toBe('CON-002');
    expect(mapped.input).toMatchObject({
      name: 'pouch_camera',
      containerKind: 'organizational',
      weightKg: 2.322,
      trackingReference: 'SMB-1',
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
  it('keeps donated and sold as first-class archived statuses', () => {
    expect(parseStatus('donated')).toBe('donated');
    expect(parseStatus('gifted')).toBe('disposed');
    const mapped = mapPossessionRow({
      'Column 1': 'ITM-0009',
      item_id: 'TV',
      status: 'sold',
      sale_price: '350',
    })!;
    expect(mapped.input).toMatchObject({
      status: 'sold',
      isArchived: true,
      sellPriceCents: 35000,
    });
    expect(mapped.input.metadata).toEqual({ importedFrom: 'possessions-sheet' });
  });
});

describe('mapShoppingRow', () => {
  const today = new Date('2026-09-29T12:00:00Z');
  const base = {
    'order date': '2026-09-22',
    Category: 'technology',
    Subcategory: 'power_accessory',
    'Item type': 'Cable',
    Product: 'Example brand',
    Quantity: '3',
    Source: 'https://www.amazon.co.uk/dp/B000000000',
    Priority: 'Essential',
    price: '4.99',
    'Delivery day': '2026-09-23',
    'Order #': '000-0000000-0000000',
  };
  it('uses the line total, GBP for UK stores, and marks arrived orders delivered', () => {
    const { input } = mapShoppingRow(base, 1, today)!;
    expect(input).toMatchObject({
      name: 'Cable (Example brand) ×3',
      status: 'delivered',
      priceCents: 1497,
      currencyCode: 'GBP',
    });
    expect(input.metadata).toMatchObject({
      orderNumber: '000-0000000-0000000',
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
  it('survives malformed URLs instead of aborting the import', () => {
    const row = { ...base, Source: 'http://' };
    const mapped = mapShoppingRow(row, 1, today)!;
    expect(mapped.input.url).toBeNull();
    expect(mapped.input.metadata).not.toHaveProperty('merchant');
  });
  it('only stores http(s) links, never other schemes', () => {
    for (const source of [
      'ftp://example.com/item',
      'javascript://evil/%0Aalert(1)',
      'file://host/etc/passwd',
    ]) {
      const mapped = mapShoppingRow({ ...base, Source: source }, 1, today)!;
      expect(mapped.input.url).toBeNull();
    }
    expect(
      mapShoppingRow({ ...base, Source: 'https://www.argos.co.uk/p/1' }, 1, today)!.input.url,
    ).toBe('https://www.argos.co.uk/p/1');
  });
  it('treats an order date alone as evidence the item was ordered', () => {
    const row = { ...base, 'Order #': '', 'Delivery day': '' };
    expect(mapShoppingRow(row, 1, today)!.input.status).toBe('ordered');
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
