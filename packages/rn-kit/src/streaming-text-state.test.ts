import { describe, expect, it } from 'vitest';

import { advance, initialState, settleOld } from './streaming-text-state';

describe('streaming text state', () => {
  it('starts fully settled', () => {
    const s = initialState('hi');
    expect(s).toEqual({ settled: 'hi', chunks: [], seen: 'hi', nextId: 0 });
  });

  it('returns the same state when content is unchanged', () => {
    const s = initialState('hi');
    expect(advance(s, 'hi', 1)).toBe(s);
  });

  it('turns an extension into a new chunk', () => {
    const s = advance(initialState('hi'), 'hi there', 10);
    expect(s.settled).toBe('hi');
    expect(s.chunks).toEqual([{ id: 0, text: ' there', bornAt: 10 }]);
    expect(s.seen).toBe('hi there');
  });

  it('gives each chunk a unique id', () => {
    let s = initialState('');
    s = advance(s, 'a', 1);
    s = advance(s, 'ab', 2);
    expect(s.chunks.map((c) => c.id)).toEqual([0, 1]);
  });

  it('resets when text is replaced instead of extended', () => {
    let s = advance(initialState(''), 'hello', 1);
    s = advance(s, 'bye', 2);
    expect(s).toEqual(initialState('bye'));
  });

  it('settles only chunks past the cutoff, in order', () => {
    let s = initialState('');
    s = advance(s, 'a', 100);
    s = advance(s, 'ab', 900);
    const settled = settleOld(s, 1400, 1250);
    expect(settled.settled).toBe('a');
    expect(settled.chunks.map((c) => c.text)).toEqual(['b']);
  });

  it('returns the same state when nothing is ready to settle', () => {
    const s = advance(initialState(''), 'a', 100);
    expect(settleOld(s, 200, 1250)).toBe(s);
  });

  it('folds everything once all chunks are old', () => {
    let s = advance(initialState(''), 'a', 0);
    s = advance(s, 'ab', 1);
    const settled = settleOld(s, 5000, 1250);
    expect(settled.settled).toBe('ab');
    expect(settled.chunks).toEqual([]);
  });
});
