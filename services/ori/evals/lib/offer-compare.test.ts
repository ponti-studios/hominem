import { expect, test } from 'bun:test';

import { normalizeOfferForGrading } from './offer-compare';

test('normalizes benign absent values without changing explicit facts', () => {
  const normalized = JSON.parse(
    normalizeOfferForGrading(
      JSON.stringify({
        offers: [
          {
            baseSalary: 215000,
            currency: 'usd',
            location: 'London, Ontario',
            employmentType: 'employee',
            hasEquity: false,
            equityType: 'stock options',
            equityCliff: 0,
            bonusFrequency: 'bi annual',
          },
        ],
        person: { homeCity: 'London, Ontario' },
      }),
      'candidate',
    ),
  );

  expect(normalized.offers[0].location).toEqual('london-ontario');
  expect(normalized.offers[0].currency).toEqual('USD');
  expect(normalized.offers[0].employmentType).toEqual(null);
  expect(normalized.offers[0].hasEquity).toEqual(null);
  expect(normalized.offers[0].equityType).toEqual('stock-options');
  expect(normalized.offers[0].equityCliff).toEqual(0);
  expect(normalized.offers[0].bonusFrequency).toEqual('bi-annual');
  expect(normalized.person.homeCity).toEqual('london-ontario');
});

test('preserves contractor and true values while rejecting malformed output', () => {
  const normalized = JSON.parse(
    normalizeOfferForGrading(
      JSON.stringify({
        offers: [{ employmentType: 'contractor', hasBonus: true }],
        person: {},
      }),
      'candidate',
    ),
  );

  expect(normalized.offers[0].employmentType).toEqual('contractor');
  expect(normalized.offers[0].hasBonus).toEqual(true);

  let failure = '';
  try {
    normalizeOfferForGrading('not json', 'candidate');
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
  }
  expect(failure).toContain('candidate offer output is not valid JSON');
});
