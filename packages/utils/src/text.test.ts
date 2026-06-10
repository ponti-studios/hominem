import { describe, expect, it } from 'vitest';

import { buildContentPreview, slugifyText } from './text';

describe('text helpers', () => {
  it('slugifies text into a stable mention-safe token', () => {
    expect(slugifyText(' Hello, World! ')).toBe('hello-world');
    expect(slugifyText('---')).toBeNull();
    expect(slugifyText(null)).toBeNull();
  });

  it('builds normalized content previews', () => {
    expect(buildContentPreview(null, '  hello   world  ')).toBe('hello world');
    expect(buildContentPreview('  existing   excerpt  ', 'ignored')).toBe('existing excerpt');
    expect(buildContentPreview(null, 'x'.repeat(260))).toHaveLength(240);
  });
});
