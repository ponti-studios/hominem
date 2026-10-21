// A realistic note of a given length: the same block of mixed markdown, repeated.
const BLOCK = [
  '# Weekend in Lisbon',
  '',
  'Land Friday evening, **keep Saturday open** and see what feels right. _No fixed itinerary._',
  '',
  '- [x] Book the flights',
  '- [ ] Dinner on Friday',
  '## Food to try',
  '- Pastéis de nata at the old bakery',
  '  - ask about ~~the tourist place~~ the small one',
  '1. First stop',
  '> The best meal is usually the one nobody recommended.',
  'Bring `charger`, passport, and the **good camera** (snake_case_name stays plain).',
  '',
].join('\n');

export function longNote(chars: number) {
  let text = '';
  while (text.length < chars) {
    text += `${BLOCK}\n`;
  }
  return text.slice(0, chars);
}
