// Times parseNoteMarkdown (the live-markdown parser) on notes of growing size.
//
//   node apps/omiro/scripts/bench-note-parser.ts
//
// This runs on Node's JIT, which is much faster than the Hermes interpreter the parser runs on inside
// the app, so read the numbers as a floor and as a check that cost grows linearly with note length.
// For the real figure, time the same input on a device (see the spike notes).
import { parseNoteMarkdown } from '../components/notes/note-markdown-parser.ts';

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

function note(chars: number) {
  let text = '';
  while (text.length < chars) {
    text += `${BLOCK}\n`;
  }
  return text.slice(0, chars);
}

function time(input: string, runs: number) {
  for (let i = 0; i < 20; i++) {
    parseNoteMarkdown(input);
  }
  const samples: number[] = [];
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    parseNoteMarkdown(input);
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  return { median: samples[Math.floor(runs / 2)] ?? 0, p95: samples[Math.floor(runs * 0.95)] ?? 0 };
}

console.log('chars    ranges   median ms   p95 ms   ms per 1k chars');
for (const chars of [1_000, 4_000, 10_000, 25_000, 50_000]) {
  const input = note(chars);
  const { median, p95 } = time(input, 300);
  const ranges = parseNoteMarkdown(input).length;
  console.log(
    `${String(chars).padStart(6)}  ${String(ranges).padStart(7)}  ${median.toFixed(3).padStart(10)}  ${p95.toFixed(3).padStart(7)}  ${((median / chars) * 1000).toFixed(4).padStart(14)}`,
  );
}

// Worst cases for a scanner: a lot of markers that never close, on one very long line.
const hostile = `${'** _ ~~ ` '.repeat(5_000)}`.slice(0, 50_000);
const hostileTime = time(hostile, 50);
console.log(
  `\n50,000 chars of unclosed markers on one line: median ${hostileTime.median.toFixed(3)} ms`,
);
