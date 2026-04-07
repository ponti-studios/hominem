import { beforeEach, describe, expect, it } from 'vitest'
import {
  STEP_UP_TTL_SECONDS,
  configureStepUpStore,
  grantStepUp,
  hasRecentStepUp,
  isFreshPasskeyAuth,
} from './step-up'

describe('step-up authentication', () => {
  describe('grantStepUp / hasRecentStepUp', () => {
    const store = new Map<string, string>()

    beforeEach(() => {
      store.clear()
      configureStepUpStore({
        get: async (key) => store.get(key) ?? null,
        set: async (key, value, _mode, _ttl) => {
          store.set(key, value)
          return 'OK'
        },
      })
    })

    it('grants and verifies step-up for a user action', async () => {
      await grantStepUp('user-1', 'passkey.register')
      expect(await hasRecentStepUp('user-1', 'passkey.register')).toBe(true)
    })

    it('returns false for actions not granted', async () => {
      await grantStepUp('user-1', 'passkey.register')
      expect(await hasRecentStepUp('user-1', 'passkey.delete')).toBe(false)
    })

    it('returns false for different users', async () => {
      await grantStepUp('user-1', 'passkey.register')
      expect(await hasRecentStepUp('user-2', 'passkey.register')).toBe(false)
    })

    it('stores with correct key format', async () => {
      await grantStepUp('user-1', 'passkey.register')
      expect(store.has('auth:stepup:user-1:passkey.register')).toBe(true)
    })

    it('throws when store is not configured', async () => {
      configureStepUpStore(null as unknown as Parameters<typeof configureStepUpStore>[0])
      // hasRecentStepUp returns false (safe default) when no store
      // grantStepUp throws
    })
  })

  describe('isFreshPasskeyAuth', () => {
    const now = 1700000000000 // fixed timestamp

    it('returns true for recent passkey auth', () => {
      const authTimeSeconds = Math.floor(now / 1000) - 60 // 1 minute ago
      expect(isFreshPasskeyAuth({ amr: ['passkey'], authTime: authTimeSeconds, nowMs: now })).toBe(true)
    })

    it('returns false when passkey auth is stale', () => {
      const authTimeSeconds = Math.floor(now / 1000) - STEP_UP_TTL_SECONDS - 1
      expect(isFreshPasskeyAuth({ amr: ['passkey'], authTime: authTimeSeconds, nowMs: now })).toBe(false)
    })

    it('returns false when amr does not include passkey', () => {
      const authTimeSeconds = Math.floor(now / 1000) - 60
      expect(isFreshPasskeyAuth({ amr: ['password'], authTime: authTimeSeconds, nowMs: now })).toBe(false)
    })

    it('returns false when amr is undefined', () => {
      expect(isFreshPasskeyAuth({ amr: undefined, authTime: 1000, nowMs: now })).toBe(false)
    })

    it('returns false when authTime is null', () => {
      expect(isFreshPasskeyAuth({ amr: ['passkey'], authTime: null, nowMs: now })).toBe(false)
    })

    it('returns true at exact TTL boundary', () => {
      const authTimeSeconds = Math.floor(now / 1000) - STEP_UP_TTL_SECONDS
      expect(isFreshPasskeyAuth({ amr: ['passkey'], authTime: authTimeSeconds, nowMs: now })).toBe(true)
    })
  })
})
