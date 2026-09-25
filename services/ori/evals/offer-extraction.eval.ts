import { loadJson, loadText, registerJsonSuite, render, type Golden } from './lib/evaluator';
import { offerSchema } from './lib/schemas';

const suiteDir = new URL('../data/offer-extraction/', import.meta.url);
const prompt = await loadText(new URL('prompt.md', suiteDir));
const cases = await loadJson<Golden[]>(new URL('goldens.json', suiteDir));

registerJsonSuite({
  name: 'offer extraction',
  cases,
  buildInput: (golden) => ({
    prompt: render(prompt, { notes: golden.input }),
    systemPrompt: '',
  }),
  outputSchema: offerSchema,
  rubric: [
    'Compare actual output to the reference and source notes semantically, ignoring JSON field order.',
    'Require every stated compensation, currency, location, equity, bonus, visa, relocation, employment, and profile fact.',
    'Require responsible currency inference and explicit ambiguity only for direct contradiction.',
    'Penalize omissions, invented values, incorrect nulls, or merging multiple offers.',
    'For fields the user notes do not state, a benign default is equivalent to null: employmentType "employee", hasRelocation false, hasEquity false, requiresVisa false, and employerCoversVisa false are all acceptable in place of null, and null is acceptable in place of them.',
    'Still penalize fabricated facts the notes do not state: invented homeCity, currency, salary, equity values/cliff/vesting frequency, bonus amounts/frequency, visa types, or relocation allowances.',
  ].join('\n'),
});
