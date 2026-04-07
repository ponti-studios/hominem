
import { resolveIsLoadingAuth } from '../utils/auth/provider-utils'
import { buildAuthUser } from './support/fixtures'

describe('resolveIsLoadingAuth', () => {
  it('is true while booting', () => {
    expect(
      resolveIsLoadingAuth({ status: 'booting', user: null, error: null, isLoading: false }),
    ).toBe(true)
  })

  it('is true while explicit loading flag is set', () => {
    expect(
      resolveIsLoadingAuth({ status: 'signed_out', user: null, error: null, isLoading: true }),
    ).toBe(true)
  })

  it('is false when not booting and not loading', () => {
    expect(
      resolveIsLoadingAuth({
        status: 'signed_in',
        user: buildAuthUser(),
        error: null,
        isLoading: false,
      }),
    ).toBe(false)
  })
})
