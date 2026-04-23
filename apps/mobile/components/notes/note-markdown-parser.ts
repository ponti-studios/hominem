import type { MarkdownRange } from '@expensify/react-native-live-markdown';

function appendHeadingRange(text: string, ranges: MarkdownRange[], start: number, len: number) {
  'worklet';
  const lineEnd = text.indexOf('\n', start);
  const end = lineEnd === -1 ? len : lineEnd;
  ranges.push({ type: 'h1', start, length: end - start });
  ranges.push({ type: 'syntax', start, length: 2 });

  return end;
}

function appendDelimitedRange(
  text: string,
  ranges: MarkdownRange[],
  type: MarkdownRange['type'],
  marker: string,
  start: number,
  searchFrom: number,
  minCloseIndex: number,
) {
  'worklet';
  const closeIdx = text.indexOf(marker, searchFrom);

  if (closeIdx === -1 || closeIdx <= minCloseIndex) {
    return -1;
  }

  const markerLength = marker.length;
  ranges.push({ type, start, length: closeIdx + markerLength - start });
  ranges.push({ type: 'syntax', start, length: markerLength });
  ranges.push({ type: 'syntax', start: closeIdx, length: markerLength });

  return closeIdx + markerLength;
}

function appendDelimitedRangeAt(
  text: string,
  ranges: MarkdownRange[],
  index: number,
  ch: string,
  prev: string,
  atLineStart: boolean,
  len: number,
) {
  'worklet';
  if (ch === '*' && index + 1 < len && text[index + 1] === '*') {
    return appendDelimitedRange(text, ranges, 'bold', '**', index, index + 2, index + 2);
  }

  if (ch === '_' && (atLineStart || prev === ' ') && index + 2 < len) {
    return appendDelimitedRange(text, ranges, 'italic', '_', index, index + 1, index + 1);
  }

  if (ch === '~' && index + 1 < len && text[index + 1] === '~') {
    return appendDelimitedRange(text, ranges, 'strikethrough', '~~', index, index + 2, index + 2);
  }

  if (ch === '`') {
    return appendDelimitedRange(text, ranges, 'code', '`', index, index + 1, index);
  }

  return -1;
}

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
      i = appendHeadingRange(text, ranges, i, len);
      continue;
    }

    const nextIndex = appendDelimitedRangeAt(text, ranges, i, ch, prev, atLineStart, len);
    if (nextIndex !== -1) {
      i = nextIndex;
      continue;
    }

    i++;
  }

  return ranges;
}
