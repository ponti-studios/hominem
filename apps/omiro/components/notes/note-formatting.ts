export const FORMAT_COMMANDS = [
  'bold',
  'italic',
  'code',
  'strikethrough',
  'heading',
  'bullet',
  'numbered-list',
  'checklist',
  'blockquote',
  'indent',
  'outdent',
] as const;

export type FormatCommand = (typeof FORMAT_COMMANDS)[number];

export interface TextSelection {
  start: number;
  end: number;
}

export interface FormatCommandResult {
  text: string;
  selection: TextSelection;
}

function lineStart(text: string, pos: number): number {
  if (pos <= 0) {
    return 0;
  }
  const idx = text.lastIndexOf('\n', pos - 1);
  return idx === -1 ? 0 : idx + 1;
}

/**
 * Applies `change` to every line the selection touches. `change` returns the new line; the
 * selection start moves by the first line's change (never before that line) and the end by the
 * total change.
 */
function mapSelectedLines(
  text: string,
  sel: TextSelection,
  change: (line: string) => string,
): FormatCommandResult {
  const start = lineStart(text, sel.start);
  // A selection that ends just after a newline does not include the next line.
  const lastChar = sel.end > sel.start && text[sel.end - 1] === '\n' ? sel.end - 1 : sel.end;
  const nextBreak = text.indexOf('\n', lastChar);
  const end = nextBreak === -1 ? text.length : nextBreak;
  const lines = text.slice(start, end).split('\n');
  const changed = lines.map(change);
  const firstDelta = changed[0].length - lines[0].length;
  const totalDelta = changed.join('\n').length - (end - start);
  return {
    text: text.slice(0, start) + changed.join('\n') + text.slice(end),
    selection: {
      start: Math.max(sel.start + firstDelta, start),
      end: Math.max(sel.end + totalDelta, start),
    },
  };
}

function wrapSelection(
  text: string,
  sel: TextSelection,
  prefix: string,
  suffix: string,
): FormatCommandResult {
  if (sel.start === sel.end) {
    const next = text.slice(0, sel.start) + prefix + suffix + text.slice(sel.start);
    const cursor = sel.start + prefix.length;
    return { text: next, selection: { start: cursor, end: cursor } };
  }

  const before = text.slice(0, sel.start);
  const selected = text.slice(sel.start, sel.end);
  const after = text.slice(sel.end);

  if (selected.startsWith(prefix) && selected.endsWith(suffix)) {
    const inner = selected.slice(prefix.length, selected.length - suffix.length);
    return {
      text: before + inner + after,
      selection: { start: sel.start, end: sel.start + inner.length },
    };
  }

  const end = sel.end + prefix.length + suffix.length;
  return {
    text: before + prefix + selected + suffix + after,
    selection: { start: end, end },
  };
}

function toggleLinePrefix(text: string, sel: TextSelection, prefix: string): FormatCommandResult {
  const start = lineStart(text, sel.start);
  const nextBreak = text.indexOf('\n', sel.end > sel.start ? sel.end - 1 : sel.end);
  const block = text.slice(start, nextBreak === -1 ? text.length : nextBreak);
  const blockLines = block.split('\n');
  // Blank lines are left alone in a multi-line selection, but a single blank line gets the prefix.
  const skipBlank = blockLines.length > 1;
  const filled = blockLines.filter((line) => line.length > 0);
  const allHave = filled.length > 0 && filled.every((line) => line.startsWith(prefix));
  return mapSelectedLines(text, sel, (line) => {
    if (allHave) {
      return line.startsWith(prefix) ? line.slice(prefix.length) : line;
    }
    return (skipBlank && line.length === 0) || line.startsWith(prefix) ? line : prefix + line;
  });
}

function indentLine(text: string, sel: TextSelection, spaces = '  '): FormatCommandResult {
  return mapSelectedLines(text, sel, (line) => spaces + line);
}

function outdentLine(text: string, sel: TextSelection): FormatCommandResult {
  return mapSelectedLines(text, sel, (line) => line.replace(/^ {1,2}/, ''));
}

export function applyFormatCommand(
  text: string,
  selection: TextSelection,
  command: FormatCommand,
): FormatCommandResult {
  switch (command) {
    case 'bold':
      return wrapSelection(text, selection, '**', '**');
    case 'italic':
      return wrapSelection(text, selection, '_', '_');
    case 'code':
      return wrapSelection(text, selection, '`', '`');
    case 'strikethrough':
      return wrapSelection(text, selection, '~~', '~~');
    case 'heading':
      return toggleLinePrefix(text, selection, '# ');
    case 'bullet':
      return toggleLinePrefix(text, selection, '- ');
    case 'numbered-list':
      return toggleLinePrefix(text, selection, '1. ');
    case 'checklist':
      return toggleLinePrefix(text, selection, '- [ ] ');
    case 'blockquote':
      return toggleLinePrefix(text, selection, '> ');
    case 'indent':
      return indentLine(text, selection);
    case 'outdent':
      return outdentLine(text, selection);
  }
}
