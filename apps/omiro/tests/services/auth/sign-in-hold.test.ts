// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { setSignInHold, useSignInHold } from '~/services/auth/sign-in-hold';

describe('sign-in hold', () => {
  it('reports whether the route guards are being held', () => {
    const { result } = renderHook(() => useSignInHold());
    expect(result.current).toBe(false);

    act(() => setSignInHold(true));
    expect(result.current).toBe(true);

    act(() => setSignInHold(false));
    expect(result.current).toBe(false);
  });
});
