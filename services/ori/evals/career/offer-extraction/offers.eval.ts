import { loadJson, loadText, registerJsonSuite, render, type Golden } from '../../lib/evaluator';
import { offerSchema } from '../../lib/schemas';

const suiteDir = new URL('./', import.meta.url);
const prompt = await loadText(new URL('system-prompt.md', suiteDir));
const cases = await loadJson<Golden[]>(new URL('expected-cases.json', suiteDir));
type OfferEvalOutput = { offers: unknown[]; person: unknown };

function assertKeysMatch(actual: unknown, expected: unknown, path: string): void {
  if (typeof actual !== 'object' || actual === null || Array.isArray(actual)) {
    throw new Error(`${path} must be an object`);
  }
  if (typeof expected !== 'object' || expected === null || Array.isArray(expected)) {
    throw new Error(`Invalid expected object at ${path}`);
  }

  const actualKeys = Object.keys(actual).sort();
  const expectedKeys = Object.keys(expected).sort();
  if (actualKeys.join() !== expectedKeys.join()) {
    throw new Error(
      `${path} keys differ: missing [${expectedKeys.filter((key) => !actualKeys.includes(key)).join(', ')}], extra [${actualKeys.filter((key) => !expectedKeys.includes(key)).join(', ')}]`,
    );
  }
}

registerJsonSuite({
  name: 'career offer extraction',
  cases,
  buildInput: (golden) => ({
    prompt: render(prompt, { notes: golden.input }),
    systemPrompt: '',
  }),
  outputSchema: offerSchema,
  assertOutput: (text, golden) => {
    const actual = JSON.parse(text) as OfferEvalOutput;
    const expected = JSON.parse(golden.expectedOutput) as OfferEvalOutput;
    assertKeysMatch(actual, expected, 'output');

    if (!Array.isArray(actual.offers) || !Array.isArray(expected.offers)) {
      throw new Error('offers must be an array');
    }
    if (actual.offers.length !== expected.offers.length) {
      throw new Error(
        `expected ${expected.offers.length} offers, received ${actual.offers.length}`,
      );
    }
    actual.offers.forEach((offer, index) =>
      assertKeysMatch(offer, expected.offers[index], `offers[${index}]`),
    );
    assertKeysMatch(actual.person, expected.person, 'person');
  },
  rubric: [
    'Compare actual output to the reference and source notes semantically, ignoring JSON field order.',
    'Require every stated base salary, total compensation, one-time bonus amount, currency, location, equity, bonus, visa, relocation, employment, and profile fact.',
    'Require responsible currency inference and explicit ambiguity only for direct contradiction.',
    'currencyAmbiguous is always boolean: true only for a direct currency/location conflict, otherwise false.',
    'A dollar symbol in an equity detail still identifies USD when no location conflicts with it; in a conflict, use the location currency and set currencyAmbiguous true.',
    'Require bonusFrequency only when the notes state a cadence; do not assume annual for an unspecified bonus.',
    'Normalize hourly and daily rates to annual baseSalary using the prompt rules; for $150/hour with no schedule, the expected annual equivalent is $312,000. Do not require a separate hourly-rate or contract-duration field.',
    'Penalize omissions, invented values, incorrect nulls, or merging multiple offers.',
    'For yes/no fields, require true or false only when the notes support that answer; otherwise require null.',
    'Require employmentType and homeCity to be grounded in explicit personal or employment details, never inferred from an offer location or missing details.',
    'Require one-time sign-on bonus amounts in oneTimeBonusAmount and frequency "one-time".',
    'Preserve the distinction between married filing jointly and married filing separately.',
    'An employer paying the UK NHS surcharge counts as employerCoversVisa true.',
    'Reject any output keys not present in the reference schema.',
    'Penalize fabricated facts the notes do not state, including currency, salary, equity values/cliff/vesting frequency, bonus amounts/frequency, visa types, and relocation allowances.',
  ].join('\n'),
});
