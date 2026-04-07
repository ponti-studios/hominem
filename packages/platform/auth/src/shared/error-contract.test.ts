import { describe, expect, it } from 'vitest'
import { buildAuthCallbackErrorRedirect, readAuthErrorMessage } from './error-contract'

describe('buildAuthCallbackErrorRedirect', () => {
  it('appends error code to the fallback path', () => {
    const url = buildAuthCallbackErrorRedirect({
      next: null,
      fallback: '/auth',
      code: 'access_denied',
    })
    expect(url).toBe('/auth?error=access_denied')
  })

  it('appends both code and description', () => {
    const url = buildAuthCallbackErrorRedirect({
      next: null,
      fallback: '/auth',
      code: 'server_error',
      description: 'Something broke',
    })
    expect(url).toContain('error=server_error')
    expect(url).toContain('description=Something+broke')
  })

  it('uses safe redirect from next when valid', () => {
    const url = buildAuthCallbackErrorRedirect({
      next: '/home',
      fallback: '/auth',
      allowedPrefixes: ['/home', '/auth'],
      code: 'access_denied',
    })
    expect(url).toBe('/home?error=access_denied')
  })

  it('falls back when next is an unsafe redirect', () => {
    const url = buildAuthCallbackErrorRedirect({
      next: 'https://evil.com',
      fallback: '/auth',
      code: 'access_denied',
    })
    expect(url).toBe('/auth?error=access_denied')
  })

  it('returns plain path when no code or description', () => {
    const url = buildAuthCallbackErrorRedirect({
      next: null,
      fallback: '/auth',
    })
    expect(url).toBe('/auth')
  })
})

describe('readAuthErrorMessage', () => {
  it('returns description if present', () => {
    const params = new URLSearchParams('description=Custom+message')
    expect(readAuthErrorMessage(params)).toBe('Custom message')
  })

  it('reads error_description as fallback', () => {
    const params = new URLSearchParams('error_description=OAuth+error')
    expect(readAuthErrorMessage(params)).toBe('OAuth error')
  })

  it('maps known error codes to messages', () => {
    expect(readAuthErrorMessage(new URLSearchParams('error=access_denied'))).toBe('Access was denied.')
    expect(readAuthErrorMessage(new URLSearchParams('error=server_error'))).toBe('A server error occurred. Please try again.')
    expect(readAuthErrorMessage(new URLSearchParams('error=temporarily_unavailable'))).toBe('The service is temporarily unavailable. Please try again.')
  })

  it('returns raw code for unknown error codes', () => {
    expect(readAuthErrorMessage(new URLSearchParams('error=custom_thing'))).toBe('custom_thing')
  })

  it('returns null when no error params', () => {
    expect(readAuthErrorMessage(new URLSearchParams(''))).toBeNull()
  })
})
