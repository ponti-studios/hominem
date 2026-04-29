import { describe, expect, it } from 'vitest';

import { parseNoteMarkdown } from '~/components/notes/note-markdown-parser';

describe('parseNoteMarkdown', () => {
  it('marks h1 text and syntax at the start of a line', () => {
    expect(parseNoteMarkdown('# Title\nBody')).toEqual([
      { type: 'h1', start: 0, length: 7 },
      { type: 'syntax', start: 0, length: 2 },
    ]);

    expect(parseNoteMarkdown('Intro\n# Next')).toEqual([
      { type: 'h1', start: 6, length: 6 },
      { type: 'syntax', start: 6, length: 2 },
    ]);
  });

  it('marks blockquote text and syntax at the start of a line', () => {
    expect(parseNoteMarkdown('> Quote')).toEqual([
      { type: 'blockquote', start: 0, length: 7 },
      { type: 'syntax', start: 0, length: 2 },
    ]);

    expect(parseNoteMarkdown('Intro\n> Pull quote here')).toEqual([
      { type: 'blockquote', start: 6, length: 17 },
      { type: 'syntax', start: 6, length: 2 },
    ]);
  });

  it('marks fenced code blocks as pre with syntax ranges', () => {
    expect(parseNoteMarkdown('```code```')).toEqual([
      { type: 'pre', start: 0, length: 10 },
      { type: 'syntax', start: 0, length: 3 },
      { type: 'syntax', start: 7, length: 3 },
    ]);
  });

  it('marks paired inline delimiters and their syntax ranges', () => {
    expect(parseNoteMarkdown('**bold** _em_ ~~gone~~ `code`')).toEqual([
      { type: 'bold', start: 0, length: 8 },
      { type: 'syntax', start: 0, length: 2 },
      { type: 'syntax', start: 6, length: 2 },
      { type: 'italic', start: 9, length: 4 },
      { type: 'syntax', start: 9, length: 1 },
      { type: 'syntax', start: 12, length: 1 },
      { type: 'strikethrough', start: 14, length: 8 },
      { type: 'syntax', start: 14, length: 2 },
      { type: 'syntax', start: 20, length: 2 },
      { type: 'code', start: 23, length: 6 },
      { type: 'syntax', start: 23, length: 1 },
      { type: 'syntax', start: 28, length: 1 },
    ]);
  });

  it('ignores unsupported or incomplete markdown', () => {
    expect(parseNoteMarkdown('word_inner_ ** ~~')).toEqual([]);
    expect(parseNoteMarkdown('Not # heading')).toEqual([]);
  });

  it('keeps the existing empty inline code behavior', () => {
    expect(parseNoteMarkdown('``')).toEqual([
      { type: 'code', start: 0, length: 2 },
      { type: 'syntax', start: 0, length: 1 },
      { type: 'syntax', start: 1, length: 1 },
    ]);
  });

  it('treats triple backtick as pre, not inline code', () => {
    expect(parseNoteMarkdown('```x```')).toEqual([
      { type: 'pre', start: 0, length: 7 },
      { type: 'syntax', start: 0, length: 3 },
      { type: 'syntax', start: 4, length: 3 },
    ]);
  });
});
