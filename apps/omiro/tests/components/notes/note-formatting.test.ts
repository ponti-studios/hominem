import { describe, expect, it } from 'vitest';

import {
  applyFormatCommand,
  FORMAT_COMMANDS,
  type FormatCommand,
} from '~/components/notes/note-formatting';

describe('note-formatting public API', () => {
  it('exports the supported command set as a stable public surface', () => {
    expect(FORMAT_COMMANDS).toEqual([
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
    ] satisfies FormatCommand[]);
  });

  it('wraps and unwraps inline selections for supported inline commands', () => {
    expect(applyFormatCommand('hello', { start: 0, end: 5 }, 'bold')).toEqual({
      text: '**hello**',
      selection: { start: 9, end: 9 },
    });
    expect(applyFormatCommand('**hello**', { start: 0, end: 9 }, 'bold')).toEqual({
      text: 'hello',
      selection: { start: 0, end: 5 },
    });

    expect(applyFormatCommand('hello', { start: 0, end: 5 }, 'italic')).toEqual({
      text: '_hello_',
      selection: { start: 7, end: 7 },
    });
    expect(applyFormatCommand('_hello_', { start: 0, end: 7 }, 'italic')).toEqual({
      text: 'hello',
      selection: { start: 0, end: 5 },
    });

    expect(applyFormatCommand('hello', { start: 0, end: 5 }, 'code')).toEqual({
      text: '`hello`',
      selection: { start: 7, end: 7 },
    });
    expect(applyFormatCommand('`hello`', { start: 0, end: 7 }, 'code')).toEqual({
      text: 'hello',
      selection: { start: 0, end: 5 },
    });

    expect(applyFormatCommand('hello', { start: 0, end: 5 }, 'strikethrough')).toEqual({
      text: '~~hello~~',
      selection: { start: 9, end: 9 },
    });
    expect(applyFormatCommand('~~hello~~', { start: 0, end: 9 }, 'strikethrough')).toEqual({
      text: 'hello',
      selection: { start: 0, end: 5 },
    });
  });

  it('inserts paired markers for collapsed inline selections', () => {
    expect(applyFormatCommand('hello', { start: 5, end: 5 }, 'bold')).toEqual({
      text: 'hello****',
      selection: { start: 7, end: 7 },
    });

    expect(applyFormatCommand('hello', { start: 5, end: 5 }, 'code')).toEqual({
      text: 'hello``',
      selection: { start: 6, end: 6 },
    });
  });

  it('toggles line prefixes for block commands', () => {
    expect(applyFormatCommand('title', { start: 0, end: 0 }, 'heading')).toEqual({
      text: '# title',
      selection: { start: 2, end: 2 },
    });
    expect(applyFormatCommand('# title', { start: 2, end: 2 }, 'heading')).toEqual({
      text: 'title',
      selection: { start: 0, end: 0 },
    });

    expect(applyFormatCommand('item', { start: 0, end: 0 }, 'bullet')).toEqual({
      text: '- item',
      selection: { start: 2, end: 2 },
    });
    expect(applyFormatCommand('- item', { start: 2, end: 2 }, 'bullet')).toEqual({
      text: 'item',
      selection: { start: 0, end: 0 },
    });

    expect(applyFormatCommand('item', { start: 0, end: 0 }, 'numbered-list')).toEqual({
      text: '1. item',
      selection: { start: 3, end: 3 },
    });
    expect(applyFormatCommand('1. item', { start: 3, end: 3 }, 'numbered-list')).toEqual({
      text: 'item',
      selection: { start: 0, end: 0 },
    });

    expect(applyFormatCommand('item', { start: 0, end: 0 }, 'checklist')).toEqual({
      text: '- [ ] item',
      selection: { start: 6, end: 6 },
    });
    expect(applyFormatCommand('- [ ] item', { start: 6, end: 6 }, 'checklist')).toEqual({
      text: 'item',
      selection: { start: 0, end: 0 },
    });

    expect(applyFormatCommand('quote', { start: 0, end: 0 }, 'blockquote')).toEqual({
      text: '> quote',
      selection: { start: 2, end: 2 },
    });
    expect(applyFormatCommand('> quote', { start: 2, end: 2 }, 'blockquote')).toEqual({
      text: 'quote',
      selection: { start: 0, end: 0 },
    });
  });

  it('applies block commands relative to the current line in multiline content', () => {
    expect(
      applyFormatCommand('first line\nsecond line', { start: 11, end: 11 }, 'blockquote'),
    ).toEqual({
      text: 'first line\n> second line',
      selection: { start: 13, end: 13 },
    });

    expect(
      applyFormatCommand('first line\nsecond line', { start: 11, end: 11 }, 'numbered-list'),
    ).toEqual({
      text: 'first line\n1. second line',
      selection: { start: 14, end: 14 },
    });
  });

  it('indents and outdents while remapping the selection', () => {
    expect(applyFormatCommand('nested item', { start: 0, end: 0 }, 'indent')).toEqual({
      text: '  nested item',
      selection: { start: 2, end: 2 },
    });

    expect(applyFormatCommand('  nested item', { start: 2, end: 2 }, 'outdent')).toEqual({
      text: 'nested item',
      selection: { start: 0, end: 0 },
    });

    expect(applyFormatCommand('nested item', { start: 0, end: 0 }, 'outdent')).toEqual({
      text: 'nested item',
      selection: { start: 0, end: 0 },
    });
  });
});
