import { describe, expect, it } from 'vitest';

import { mobileTextVariantNames } from '~/components/theme/contracts';
import { appleSymbolMap } from '~/components/ui/apple-symbols';

describe('mobile design system contract', () => {
  it('exposes the Apple typography scale without deprecated aliases', () => {
    expect(mobileTextVariantNames).toEqual([
      'largeTitle',
      'title1',
      'title2',
      'headline',
      'body',
      'callout',
      'subhead',
      'footnote',
      'caption1',
      'caption2',
      'mono',
    ]);
  });

  it('maps app icons to sf symbols', () => {
    expect(appleSymbolMap['chevron.right']).toBe('chevron.right');
    expect(appleSymbolMap['square.and.pencil']).toBe('square.and.pencil');
    expect(appleSymbolMap['speaker.wave.2']).toBe('speaker.wave.2');
  });
});
