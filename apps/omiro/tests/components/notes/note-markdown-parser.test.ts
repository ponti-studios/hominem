import { describe, expect, it } from 'vitest';

import { parseNoteMarkdown } from '~/components/notes/note-markdown-parser';

// [type, the text the range covers], so expectations read like the note.
function slices(input: string) {
  return parseNoteMarkdown(input).map((range) => [
    range.type,
    input.slice(range.start, range.start + range.length),
  ]);
}

describe('parseNoteMarkdown', () => {
  it('styles nothing in plain text, blank lines and an empty note', () => {
    expect(parseNoteMarkdown('')).toEqual([]);
    expect(parseNoteMarkdown('just words\n\nmore words')).toEqual([]);
  });

  it('marks inline spans and their markers', () => {
    expect(slices('a **bold** b')).toEqual([
      ['syntax', '**'],
      ['bold', 'bold'],
      ['syntax', '**'],
    ]);
    expect(slices('an _italic_ word')).toEqual([
      ['syntax', '_'],
      ['italic', 'italic'],
      ['syntax', '_'],
    ]);
    expect(slices('~~gone~~')).toEqual([
      ['syntax', '~~'],
      ['strikethrough', 'gone'],
      ['syntax', '~~'],
    ]);
    expect(slices('run `npm test` now')).toEqual([
      ['syntax', '`'],
      ['code', 'npm test'],
      ['syntax', '`'],
    ]);
  });

  it('parses spans inside spans, but nothing inside code', () => {
    expect(slices('**bold _and italic_**')).toEqual([
      ['syntax', '**'],
      ['bold', 'bold _and italic_'],
      ['syntax', '**'],
      ['syntax', '_'],
      ['italic', 'and italic'],
      ['syntax', '_'],
    ]);
    expect(slices('`**not bold**`')).toEqual([
      ['syntax', '`'],
      ['code', '**not bold**'],
      ['syntax', '`'],
    ]);
  });

  it('leaves unmatched markers, spaced markers and snake_case words alone', () => {
    expect(parseNoteMarkdown('**open and never closed')).toEqual([]);
    expect(parseNoteMarkdown('an `unclosed tick')).toEqual([]);
    expect(parseNoteMarkdown('a snake_case_name and 2 * 3 * 4')).toEqual([]);
    expect(parseNoteMarkdown('empty ** ** and ````')).toEqual([]);
    expect(parseNoteMarkdown('** spaced **')).toEqual([]);
  });

  it('marks headings at any level with the h1 style', () => {
    expect(slices('# Plan')).toEqual([
      ['syntax', '# '],
      ['h1', 'Plan'],
    ]);
    expect(slices('### Deep')).toEqual([
      ['syntax', '### '],
      ['h1', 'Deep'],
    ]);
    expect(parseNoteMarkdown('#nospace')).toEqual([]);
    expect(parseNoteMarkdown('####### seven')).toEqual([]);
  });

  it('marks quotes, lists and tasks, and strikes completed tasks', () => {
    expect(slices('> wise words')).toEqual([
      ['syntax', '> '],
      ['blockquote', 'wise words'],
    ]);
    expect(slices('- item')).toEqual([['syntax', '- ']]);
    expect(slices('  - nested')).toEqual([['syntax', '- ']]);
    expect(slices('12. numbered')).toEqual([['syntax', '12. ']]);
    expect(slices('- [ ] todo')).toEqual([['syntax', '- [ ] ']]);
    expect(slices('- [x] done thing')).toEqual([
      ['syntax', '- [x] '],
      ['strikethrough', 'done thing'],
    ]);
  });

  it('keeps inline styling inside headings and tasks', () => {
    expect(slices('# The **big** one')).toEqual([
      ['syntax', '# '],
      ['h1', 'The **big** one'],
      ['syntax', '**'],
      ['bold', 'big'],
      ['syntax', '**'],
    ]);
    expect(slices('- [ ] call `mum`')).toEqual([
      ['syntax', '- [ ] '],
      ['syntax', '`'],
      ['code', 'mum'],
      ['syntax', '`'],
    ]);
  });

  it('reports offsets into the whole note, not the line', () => {
    const note = '# Title\n\nsome **bold** text\n- item';
    const ranges = parseNoteMarkdown(note);
    const bold = ranges.find((range) => range.type === 'bold');

    expect(bold && note.slice(bold.start, bold.start + bold.length)).toBe('bold');
    expect(ranges.at(-1)).toEqual({ type: 'syntax', start: note.indexOf('- item'), length: 2 });
  });

  it('leaves escaped delimiters literal', () => {
    expect(parseNoteMarkdown('\\_not italic\\_')).toEqual([]);
    expect(parseNoteMarkdown('\\`not code\\`')).toEqual([]);
    expect(parseNoteMarkdown('\\**not bold**')).toEqual([]);
  });

  it('still styles a delimiter after an escaped backslash', () => {
    expect(slices('\\\\_it_')).toContainEqual(['italic', 'it']);
  });

  it('ignores a trailing line break', () => {
    expect(slices('a\n**b**\n')).toEqual(slices('**b**'));
  });

  // A long line of openers that never close used to rescan to the end from each one (quadratic). On the
  // JS engine this finishes in about a millisecond; the generous bound only catches a regression.
  it.each(['_a ', '**a ', '~~a ', '`a ', 'a_b_c '])(
    'stays fast on 50,000 characters of "%s"',
    (unit) => {
      const input = unit.repeat(Math.ceil(50_000 / unit.length));
      const start = performance.now();

      parseNoteMarkdown(input);

      expect(performance.now() - start).toBeLessThan(500);
    },
  );
});
