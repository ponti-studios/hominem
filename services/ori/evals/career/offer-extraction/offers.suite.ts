import { loadJson, loadText, render, type Golden } from '../../lib/golden';
import { offerSchema } from '../../lib/schemas';
import { defineTextSuite, fileAssertion } from '../../lib/suite';

const promptUrl = new URL('./system-prompt.md', import.meta.url);
const casesUrl = new URL('./expected-cases.json', import.meta.url);
const prompt = await loadText(promptUrl);

export default await defineTextSuite({
  name: 'career-offer-extraction',
  description: 'Compensation notes become structured offers with responsible currency inference',
  tier: 'capability',
  cases: await loadJson<Golden[]>(casesUrl),
  datasetFiles: [casesUrl],
  promptFiles: [promptUrl],
  messages: (golden) => [{ role: 'user', content: render(prompt, { notes: golden.input }) }],
  schema: offerSchema,
  assertions: [fileAssertion('offer-shape.ts', undefined, 'shape')],
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
