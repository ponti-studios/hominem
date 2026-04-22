import type { MarkdownRange } from '@expensify/react-native-live-markdown';

// This entire function runs as a Reanimated worklet on the UI thread.
// Only pure string/array operations — no imports are called at runtime.
export function parseNoteMarkdown(text: string): MarkdownRange[] {
  'worklet';
  const ranges: MarkdownRange[] = [];
  const len = text.length;
  let i = 0;

  while (i < len) {
    const ch = text[i];
    const prev = i > 0 ? text[i - 1] : '\n';
    const atLineStart = prev === '\n' || i === 0;

    // H1: "# " at the start of a line
    if (atLineStart && ch === '#' && i + 1 < len && text[i + 1] === ' ') {
      const lineEnd = text.indexOf('\n', i);
      const end = lineEnd === -1 ? len : lineEnd;
      ranges.push({ type: 'h1', start: i, length: end - i });
      ranges.push({ type: 'syntax', start: i, length: 2 });
      i = end;
      continue;
    }

    // Bold: **text**
    if (ch === '*' && i + 1 < len && text[i + 1] === '*') {
      const closeIdx = text.indexOf('**', i + 2);
      if (closeIdx !== -1 && closeIdx > i + 2) {
        ranges.push({ type: 'bold', start: i, length: closeIdx + 2 - i });
        ranges.push({ type: 'syntax', start: i, length: 2 });
        ranges.push({ type: 'syntax', start: closeIdx, length: 2 });
        i = closeIdx + 2;
        continue;
      }
    }

    // Italic: _text_ (must not be inside a word — require boundary before _)
    if (ch === '_' && (atLineStart || prev === ' ') && i + 2 < len) {
      const closeIdx = text.indexOf('_', i + 1);
      if (closeIdx !== -1 && closeIdx > i + 1) {
        ranges.push({ type: 'italic', start: i, length: closeIdx + 1 - i });
        ranges.push({ type: 'syntax', start: i, length: 1 });
        ranges.push({ type: 'syntax', start: closeIdx, length: 1 });
        i = closeIdx + 1;
        continue;
      }
    }

    // Strikethrough: ~~text~~
    if (ch === '~' && i + 1 < len && text[i + 1] === '~') {
      const closeIdx = text.indexOf('~~', i + 2);
      if (closeIdx !== -1 && closeIdx > i + 2) {
        ranges.push({ type: 'strikethrough', start: i, length: closeIdx + 2 - i });
        ranges.push({ type: 'syntax', start: i, length: 2 });
        ranges.push({ type: 'syntax', start: closeIdx, length: 2 });
        i = closeIdx + 2;
        continue;
      }
    }

    // Inline code: `text`
    if (ch === '`') {
      const closeIdx = text.indexOf('`', i + 1);
      if (closeIdx !== -1) {
        ranges.push({ type: 'code', start: i, length: closeIdx + 1 - i });
        ranges.push({ type: 'syntax', start: i, length: 1 });
        ranges.push({ type: 'syntax', start: closeIdx, length: 1 });
        i = closeIdx + 1;
        continue;
      }
    }

    i++;
  }

  return ranges;
}
