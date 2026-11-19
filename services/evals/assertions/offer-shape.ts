import type { AssertionValueFunctionContext } from 'promptfoo';

import type { Golden } from '../lib/golden';

type OfferOutput = { offers: unknown[]; person: unknown };

const keysDiffer = (actual: unknown, expected: unknown, path: string): string | undefined => {
  if (typeof actual !== 'object' || actual === null || Array.isArray(actual)) {
    return `${path} must be an object`;
  }
  if (typeof expected !== 'object' || expected === null || Array.isArray(expected)) {
    return `invalid expected object at ${path}`;
  }
  const actualKeys = Object.keys(actual).sort();
  const expectedKeys = Object.keys(expected).sort();
  if (actualKeys.join() === expectedKeys.join()) return undefined;
  return `${path} keys differ: missing [${expectedKeys.filter((key) => !actualKeys.includes(key)).join(', ')}], extra [${actualKeys.filter((key) => !expectedKeys.includes(key)).join(', ')}]`;
};

/** Same offer count and same key set as the reference, at every level. */
export default function offerShape(
  output: string | object,
  context: AssertionValueFunctionContext,
) {
  const golden = context.vars.golden as Golden;
  const fail = (reason: string) => ({ pass: false, score: 0, reason });
  let actual: OfferOutput;
  try {
    actual = (typeof output === 'string' ? JSON.parse(output) : output) as OfferOutput;
  } catch {
    return fail('output is not JSON');
  }
  const expected = JSON.parse(golden.expectedOutput) as OfferOutput;
  const problem =
    keysDiffer(actual, expected, 'output') ??
    (!Array.isArray(actual.offers) || !Array.isArray(expected.offers)
      ? 'offers must be an array'
      : actual.offers.length !== expected.offers.length
        ? `expected ${expected.offers.length} offers, received ${actual.offers.length}`
        : undefined) ??
    actual.offers
      .map((offer, index) => keysDiffer(offer, expected.offers[index], `offers[${index}]`))
      .find(Boolean) ??
    keysDiffer(actual.person, expected.person, 'person');
  return problem ? fail(problem) : { pass: true, score: 1, reason: 'shape matches reference' };
}
