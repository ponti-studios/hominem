import { describe, expect, it } from 'vitest';

import { resolveIsLoadingAuth } from '~/services/auth/provider-utils';

describe('resolveIsLoadingAuth', () => {
  it('treats booting as loading even when state says otherwise', () => {
    expect(
      resolveIsLoadingAuth({
        status: 'booting',
        isLoading: false,
      } as never),
    ).toBe(true);
  });

  it('uses the state loading flag for non-booting states', () => {
    expect(
      resolveIsLoadingAuth({
        status: 'signed_out',
        isLoading: true,
      } as never),
    ).toBe(true);

    expect(
      resolveIsLoadingAuth({
        status: 'signed_out',
        isLoading: false,
      } as never),
    ).toBe(false);
  });
});
