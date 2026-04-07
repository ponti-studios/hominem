import { describe, expect, it } from 'vitest'
import { resolveAuthRedirect } from './redirect-policy'

describe('resolveAuthRedirect', () => {
  const fallback = '/home'

  describe('missing or empty input', () => {
    it('returns fallback for null', () => {
      const result = resolveAuthRedirect(null, fallback)
      expect(result).toEqual({ safeRedirect: fallback, rejectedReason: 'missing', rejectedPathname: null })
    })

    it('returns fallback for undefined', () => {
      const result = resolveAuthRedirect(undefined, fallback)
      expect(result.rejectedReason).toBe('missing')
    })

    it('returns fallback for empty string', () => {
      const result = resolveAuthRedirect('', fallback)
      expect(result.rejectedReason).toBe('missing')
    })
  })

  describe('non-local URLs', () => {
    it('rejects absolute URLs', () => {
      const result = resolveAuthRedirect('https://evil.com/steal', fallback)
      expect(result).toEqual({ safeRedirect: fallback, rejectedReason: 'non_local', rejectedPathname: null })
    })

    it('rejects URLs without leading slash', () => {
      const result = resolveAuthRedirect('home', fallback)
      expect(result.rejectedReason).toBe('non_local')
    })
  })

  describe('protocol-relative URLs', () => {
    it('rejects // prefixed paths', () => {
      const result = resolveAuthRedirect('//evil.com/steal', fallback)
      expect(result).toEqual({ safeRedirect: fallback, rejectedReason: 'protocol_relative', rejectedPathname: null })
    })
  })

  describe('disallowed paths', () => {
    it('rejects paths not in allowedPrefixes', () => {
      const result = resolveAuthRedirect('/admin/secret', fallback, ['/home', '/chat'])
      expect(result).toEqual({
        safeRedirect: fallback,
        rejectedReason: 'disallowed',
        rejectedPathname: '/admin/secret',
      })
    })

    it('uses fallback as default allowedPrefix', () => {
      const result = resolveAuthRedirect('/other', '/home')
      expect(result.rejectedReason).toBe('disallowed')
    })
  })

  describe('valid redirects', () => {
    it('accepts exact match', () => {
      const result = resolveAuthRedirect('/home', fallback, ['/home'])
      expect(result).toEqual({ safeRedirect: '/home', rejectedReason: null, rejectedPathname: null })
    })

    it('accepts sub-path of allowed prefix', () => {
      const result = resolveAuthRedirect('/chat/123', fallback, ['/chat'])
      expect(result.safeRedirect).toBe('/chat/123')
      expect(result.rejectedReason).toBeNull()
    })

    it('preserves query params', () => {
      const result = resolveAuthRedirect('/home?tab=recent', fallback, ['/home'])
      expect(result.safeRedirect).toBe('/home?tab=recent')
    })

    it('preserves hash', () => {
      const result = resolveAuthRedirect('/notes#section', fallback, ['/notes'])
      expect(result.safeRedirect).toBe('/notes#section')
    })

    it('normalizes trailing slashes in prefixes', () => {
      const result = resolveAuthRedirect('/chat', fallback, ['/chat/'])
      expect(result.safeRedirect).toBe('/chat')
    })
  })
})
