import type { MarkdownRange } from '@expensify/react-native-live-markdown';

// Styling ranges for the note editor's markdown, in the shape react-native-live-markdown expects.
//
// This runs on the UI thread on every keystroke, as a worklet, so it must stay self-contained (no
// imports used at runtime, helpers declared inside) and linear in the length of the note: one pass
// over the lines, and a bounded scan within each line.
//
// What the native side can draw is fixed by the library: `syntax` (one colour for every marker),
// `bold`, `italic`, `strikethrough`, `code`, `h1` (size + bold) and `blockquote` (indent + border). There
// is no per-element colour for headings or list markers.
export function parseNoteMarkdown(input: string): MarkdownRange[] {
  'worklet';

  const ranges: MarkdownRange[] = [];
  const push = (type: MarkdownRange['type'], start: number, length: number, depth?: number) => {
    if (length <= 0) {
      return;
    }
    if (depth === undefined) {
      ranges.push({ type, start, length });
    } else {
      ranges.push({ type, start, length, depth });
    }
  };
  const isWordChar = (code: number) =>
    (code >= 48 && code <= 57) ||
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122) ||
    code > 127;

  // Inline spans between `from` and `to` (one line). Markers become `syntax`, the text between them gets
  // the span's type, and the text between is scanned again so `**bold _and italic_**` works.
  const inline = (from: number, to: number): void => {
    // An `_` that finds no valid closing `_` before `to` means no later `_` here can either, so stop
    // looking. Without this a line of "_a _a _a ..." rescans to the end from every opener (quadratic).
    let italicDead = false;
    let i = from;
    while (i < to) {
      const code = input.charCodeAt(i);

      if (code === 96) {
        // `code`: nothing inside is parsed
        let j = i + 1;
        while (j < to && input.charCodeAt(j) !== 96) {
          j++;
        }
        if (j < to && j > i + 1) {
          push('syntax', i, 1);
          push('code', i + 1, j - i - 1);
          push('syntax', j, 1);
          i = j + 1;
          continue;
        }
      } else if ((code === 42 || code === 126) && i + 1 < to && input.charCodeAt(i + 1) === code) {
        // **bold** and ~~strikethrough~~
        let j = i + 2;
        while (j + 1 < to && !(input.charCodeAt(j) === code && input.charCodeAt(j + 1) === code)) {
          j++;
        }
        // like markdown, the text may not start or end with a space
        if (
          j + 1 < to &&
          j > i + 2 &&
          input.charCodeAt(i + 2) !== 32 &&
          input.charCodeAt(j - 1) !== 32
        ) {
          push('syntax', i, 2);
          push(code === 42 ? 'bold' : 'strikethrough', i + 2, j - i - 2);
          push('syntax', j, 2);
          inline(i + 2, j);
          i = j + 2;
          continue;
        }
      } else if (code === 95) {
        // _italic_, but not the underscores inside snake_case words
        const before = i > from ? input.charCodeAt(i - 1) : 0;
        const next = i + 1 < to ? input.charCodeAt(i + 1) : 0;
        if (!italicDead && !isWordChar(before) && next !== 0 && next !== 32 && next !== 95) {
          let j = i + 1;
          while (j < to) {
            if (input.charCodeAt(j) === 95) {
              const after = j + 1 < to ? input.charCodeAt(j + 1) : 0;
              if (input.charCodeAt(j - 1) !== 32 && !isWordChar(after)) {
                break;
              }
            }
            j++;
          }
          if (j < to) {
            push('syntax', i, 1);
            push('italic', i + 1, j - i - 1);
            push('syntax', j, 1);
            inline(i + 1, j);
            i = j + 1;
            continue;
          }
          italicDead = true;
        }
      }
      i++;
    }
  };

  const length = input.length;
  let pos = 0;
  while (pos <= length) {
    let end = input.indexOf('\n', pos);
    if (end === -1) {
      end = length;
    }

    if (end > pos) {
      let indent = pos;
      while (indent < end && input.charCodeAt(indent) === 32) {
        indent++;
      }
      const first = input.charCodeAt(indent);
      let contentStart = pos;

      if (first === 35 && indent === pos) {
        // # Heading (every level gets the h1 style: the library has no other heading size)
        let hashes = 0;
        while (hashes < 6 && input.charCodeAt(pos + hashes) === 35) {
          hashes++;
        }
        if (input.charCodeAt(pos + hashes) === 32) {
          push('syntax', pos, hashes + 1);
          push('h1', pos + hashes + 1, end - pos - hashes - 1);
          contentStart = pos + hashes + 1;
        }
      } else if (first === 62 && input.charCodeAt(indent + 1) === 32) {
        // > Quote
        push('syntax', indent, 2);
        push('blockquote', indent + 2, end - indent - 2, 1);
        contentStart = indent + 2;
      } else if (first === 45 && input.charCodeAt(indent + 1) === 32) {
        // - bullet, - [ ] task, - [x] done task
        const box = input.charCodeAt(indent + 2) === 91 && input.charCodeAt(indent + 4) === 93;
        const done =
          box && input.charCodeAt(indent + 3) === 120 && input.charCodeAt(indent + 5) === 32;
        const open =
          box && input.charCodeAt(indent + 3) === 32 && input.charCodeAt(indent + 5) === 32;
        const markerLength = done || open ? 6 : 2;
        push('syntax', indent, markerLength);
        if (done) {
          push('strikethrough', indent + 6, end - indent - 6);
        }
        contentStart = indent + markerLength;
      } else if (first >= 48 && first <= 57) {
        // 1. numbered item
        let digits = indent;
        while (digits < end && input.charCodeAt(digits) >= 48 && input.charCodeAt(digits) <= 57) {
          digits++;
        }
        if (input.charCodeAt(digits) === 46 && input.charCodeAt(digits + 1) === 32) {
          push('syntax', indent, digits - indent + 2);
          contentStart = digits + 2;
        }
      }

      inline(contentStart, end);
    }
    pos = end + 1;
  }

  return ranges;
}
